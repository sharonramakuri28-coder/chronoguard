"""RETAIN -> RECALL -> LEARN through the API, plus the Memory Brain, reports, assistant and migration."""

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from database.session import _add_missing_columns
from main import app

SAMPLES = Path(__file__).resolve().parent.parent / "data" / "samples"
V2_LEAKS = {"confirmed_fraud_flag", "payment_final_status", "investigation_outcome", "chargeback_resolution"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _upload(client, sample: str, name: str, model: str) -> dict:
    r = client.post(
        "/api/datasets",
        files={"file": (name, (SAMPLES / sample).read_bytes(), "text/csv")},
        data={"model_name": model},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(scope="module")
def story(client):
    """Scene 1-4 of the demo: first model leaks, replay, fix confirmed, next model is recognised."""
    tag = uuid.uuid4().hex[:6]
    model = f"Fraud model {tag}"
    v1 = _upload(client, "fraud_model_v1.csv", f"v1_{tag}.csv", model)
    replay = client.post(f"/api/audits/{v1['id']}/replay").json()
    feedback = client.post(f"/api/audits/{v1['id']}/feedback", json={"successful": True, "note": "retrained"}).json()
    v2 = _upload(client, "fraud_model_v2.csv", f"v2_{tag}.csv", model)
    return {"v1": v1, "v2": v2, "replay": replay, "feedback": feedback, "model": model}


def test_agent_trace_and_retained_incident_fields(client, story):
    v1 = story["v1"]
    assert v1["dataset"]["model_name"] == story["model"]
    assert [s["key"] for s in v1["agent_trace"]] == ["understand", "temporal", "memory", "recommend", "retain"]
    assert v1["agent_trace"][0]["facts"]["features"] == 13  # ids and raw event timestamps are not features
    assert set(v1["leaked_features"]) >= {"fraud_confirmed", "payment_final_state", "investigation_result"}
    assert v1["headline"].startswith("Remove ") and "payment_final_state" in v1["headline"]

    incidents = [i for i in client.get("/api/incidents").json() if i["dataset_name"] == v1["dataset"]["name"]]
    assert {i["feature"] for i in incidents} == set(v1["leaked_features"])
    inc = next(i for i in incidents if i["feature"] == "fraud_confirmed")
    assert inc["incident_type"] == "Temporal leakage" and inc["model_name"] == story["model"]
    assert inc["cause"] and inc["solution"].startswith("Remove") and inc["evidence"]["example_decision_id"]
    # Replay wrote the measured impact back into memory.
    assert story["replay"]["status"] == "completed"
    assert "inflated" in inc["impact"] and inc["impact_auc_drop"] is not None

    detail = client.get(f"/api/incidents/{inc['id']}").json()
    assert "Fix: Remove 'fraud_confirmed'" in detail["hindsight_record"]
    assert client.get("/api/incidents/999999").status_code == 404


def test_feedback_is_learned_and_changing_it_does_not_double_count(client, story):
    v1 = story["v1"]
    fb = story["feedback"]
    assert fb["feedback"]["successful"] is True
    # Its own incidents, plus any remembered incidents whose fix it recommended again.
    own = [i for i in fb["updated_incidents"] if i["dataset_name"] == v1["dataset"]["name"]]
    assert len(own) == len(v1["leaked_features"])
    recalled = {m["incident_id"] for m in v1["memory_recall"]}
    assert {i["id"] for i in fb["updated_incidents"]} == {i["id"] for i in own} | recalled
    assert all(i["fix_confirmations"] >= 1 and i["fix_confidence"] > 0.5 for i in own)

    again = client.post(f"/api/audits/{v1['id']}/feedback", json={"successful": True}).json()
    before = {i["id"]: i["fix_confirmations"] for i in fb["updated_incidents"]}
    assert all(i["fix_confirmations"] == before[i["id"]] for i in again["updated_incidents"])
    assert client.post("/api/audits/999999/feedback", json={"successful": True}).status_code == 404


def test_next_model_recalls_renamed_failures_with_confirmed_fix(client, story):
    v2 = story["v2"]
    recall = {m["matched_feature"]: m for m in v2["memory_recall"]}
    assert V2_LEAKS <= set(recall)
    assert all(m["similarity"] >= 0.5 for m in recall.values())
    memory_step = next(s for s in v2["agent_trace"] if s["key"] == "memory")
    assert memory_step["outcome"] == "found" and memory_step["facts"]["searched"] >= 5
    # The confirmation from v1's feedback travels with the recalled incident into the recommendation.
    from_v1 = [m for m in recall.values() if m["past_dataset"] == story["v1"]["dataset"]["name"]]
    assert from_v1 and all(m["fix_confirmations"] >= 1 for m in from_v1)
    recs = {r["feature"]: r for r in v2["recommendations"]}
    assert any("confirmed to work" in (recs[m["matched_feature"]]["memory"] or "") for m in from_v1)
    assert all(recs[f]["action"].startswith(f"Remove '{f}'") for f in V2_LEAKS)
    assert all(f["label"] == "Recurring leakage" for f in v2["risk"]["features"] if f["feature"] in V2_LEAKS)


def test_memory_graph_timeline_and_command_center(client, story):
    graph = client.get("/api/memory/graph").json()
    kinds = {n["kind"] for n in graph["nodes"]}
    assert kinds == {"incident", "pattern", "detection"}
    detection = next(n for n in graph["nodes"] if n["kind"] == "detection" and n["ref"] == story["v2"]["id"])
    assert any(e["target"] == detection["id"] and e["kind"] == "recalled_by" for e in graph["edges"])
    ids = {n["id"] for n in graph["nodes"]}
    assert all(e["source"] in ids and e["target"] in ids for e in graph["edges"])

    kinds = {e["kind"] for e in client.get("/api/memory/timeline").json()}
    assert {"learned", "recalled", "replay", "fix_confirmed"} <= kinds

    cc = client.get("/api/command-center").json()
    assert cc["incidents_learned"] >= 10 and cc["repeat_failures_caught"] >= 4
    assert cc["prevented_failures"] >= len(story["v1"]["leaked_features"])
    assert 0 < cc["memory_confidence"] <= 1 and cc["feedback_count"] >= 1
    assert cc["models_protected"] >= 1 and cc["patterns"] >= 1 and cc["hindsight"] == "disabled"


def test_report_contains_every_section(client, story):
    v1 = story["v1"]
    report = client.get(f"/api/reports/{v1['id']}").json()
    md = report["markdown"]
    for heading in (
        "Executive summary",
        "Risk score",
        "Evidence",
        "Timeline",
        "Model replay",
        "Memory references",
        "Recommended fixes",
        "Team feedback",
    ):
        assert f"## {heading}" in md
    assert "previous score was inflated because future information was used" in md
    assert f"{v1['risk']['score']:.0f} / 100" in md
    v2md = client.get(f"/api/reports/{story['v2']['id']}").json()["markdown"]
    assert "ChronoGuard has seen this failure before" in v2md and "confirmed" in v2md

    dl = client.get(f"/api/reports/{v1['id']}/download")
    assert dl.status_code == 200 and dl.headers["content-type"].startswith("text/markdown")
    assert "attachment" in dl.headers["content-disposition"]
    assert client.get("/api/reports/999999").status_code == 404


@pytest.mark.parametrize(
    ("message", "intent", "needle"),
    [
        ("Why was confirmed_fraud_flag risky?", "feature", "became available after the prediction"),
        ("Have we seen this failure before?", "memory", "match failures ChronoGuard remembered"),
        ("What should I fix first?", "fix", "Remove"),
        ("How was the risk score calculated?", "risk", "Formula"),
    ],
)
def test_assistant_is_grounded(client, story, message, intent, needle):
    body = client.post("/api/chat", json={"message": message, "audit_id": story["v2"]["id"]}).json()
    assert body["intent"] == intent and needle in body["answer"]
    assert body["provider"] == "grounded" and body["citations"] and body["suggestions"]


def test_assistant_explains_replay_inflation(client, story):
    body = client.post("/api/chat", json={"message": "Why did the AUC drop?", "audit_id": story["v1"]["id"]}).json()
    assert body["intent"] == "replay" and "inflated because future information was used" in body["answer"]


def test_hindsight_endpoints_fail_closed_when_disabled(client):
    status = client.get("/api/hindsight/status").json()
    assert status["state"] == "disabled" and status["host"] is None and status["total_incidents"] >= 0
    assert client.post("/api/hindsight/recall", json={"query": "chargeback"}).json()["memories"] == []
    assert client.post("/api/hindsight/reflect", json={"query": "chargeback"}).json()["answer"] is None
    assert client.post("/api/hindsight/recall", json={"query": ""}).status_code == 422


def test_samples_are_grouped_for_the_demo(client):
    samples = {s["name"]: s for s in client.get("/api/samples").json()}
    assert samples["fraud_model_v1.csv"]["group"] == "demo" and not samples["fraud_model_v1.csv"]["seed"]
    assert samples["retail_demand_forecast.csv"]["seed"]


def test_migration_adds_new_columns_to_an_old_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:  # the incidents table as it was before structured memory
        conn.execute(
            text(
                "CREATE TABLE incidents (id INTEGER PRIMARY KEY, audit_id INTEGER, dataset_name VARCHAR(255), "
                "feature VARCHAR(255), leak_rate FLOAT, median_delay_hours FLOAT, max_delay_hours FLOAT, "
                "affected_decisions INTEGER, lesson TEXT, lesson_provider VARCHAR(64), local_embedding JSON, "
                "azure_embedding JSON, hindsight_retained BOOLEAN, created_at DATETIME)"
            )
        )
        conn.execute(text("INSERT INTO incidents (id, dataset_name, feature, lesson) VALUES (1, 'd', 'f', 'l')"))
    _add_missing_columns(engine)
    _add_missing_columns(engine)  # idempotent
    cols = {c["name"] for c in inspect(engine).get_columns("incidents")}
    assert {"cause", "solution", "fix_confirmations", "hindsight_document_id"} <= cols
    with engine.connect() as conn:
        assert conn.execute(text("SELECT fix_confirmations, times_recalled FROM incidents")).one() == (0, 0)
