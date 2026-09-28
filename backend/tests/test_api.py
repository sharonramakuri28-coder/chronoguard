"""End-to-end API tests on a temporary SQLite database (no network, local memory provider)."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app  # test isolation (temporary DB, no external services) is set up in conftest.py

SAMPLES = Path(__file__).resolve().parent.parent / "data" / "samples"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_reports_local_providers(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["embedding_provider"] == "local-vectors"
    assert body["explanation_provider"] == "template"
    assert body["hindsight"] == "disabled"


def test_upload_rejects_bad_files(client):
    r = client.post("/api/datasets", files={"file": ("x.txt", b"a,b\n1,2\n", "text/plain")})
    assert r.status_code == 415
    r = client.post("/api/datasets", files={"file": ("x.csv", b"a,b\n1,2\n", "text/csv")})
    assert r.status_code == 422
    assert "prediction timestamp" in r.json()["detail"]


def test_full_flow_upload_memory_replay(client):
    # 1. First fraud dataset: leaks found, incidents remembered.
    q1 = client.post(
        "/api/datasets",
        files={"file": ("fraud_q1.csv", (SAMPLES / "fraud_detection_q1.csv").read_bytes(), "text/csv")},
    )
    assert q1.status_code == 201, q1.text
    a1 = q1.json()
    assert {"chargeback_filed", "settlement_status"} <= set(a1["leaked_features"])
    assert a1["risk"]["band"] == "high"
    assert a1["new_incidents"] == len(a1["leaked_features"])
    assert all(f["memory"] is None for f in a1["risk"]["features"])  # nothing remembered yet

    incidents = client.get("/api/memory/incidents").json()
    assert {i["feature"] for i in incidents} == set(a1["leaked_features"])

    # 2. Next quarter's dataset with renamed columns: memory recognises the recurring leak.
    q2 = client.post("/api/samples/fraud_detection_q2_wide.csv/audit")
    assert q2.status_code == 201
    risk = {f["feature"]: f for f in q2.json()["risk"]["features"]}
    assert risk["cb_resolution_flag"]["label"] == "Recurring leakage"
    assert risk["cb_resolution_flag"]["memory"]["feature"] == "chargeback_filed"
    assert risk["cb_resolution_flag"]["memory_score"] > 0

    # 3. Memory search.
    s = client.post("/api/memory/search", json={"query": "chargeback outcome"}).json()
    assert s["provider"] == "local-vectors"
    assert s["hits"][0]["incident"]["feature"] == "chargeback_filed"

    # 4. Replay measures the drop from removing leaked features.
    assert client.get(f"/api/audits/{a1['id']}/replay").json() is None  # not run yet
    rep = client.post(f"/api/audits/{a1['id']}/replay").json()
    assert rep["status"] == "completed"
    assert rep["result"]["baseline"]["auc"] > rep["result"]["leak_free"]["auc"]
    assert client.get(f"/api/audits/{a1['id']}/replay").json()["id"] == rep["id"]

    # 5. Affected decisions paging and dashboard aggregates.
    page = client.get(f"/api/audits/{a1['id']}/affected?limit=10").json()
    assert page["total"] == a1["affected_decisions"] and len(page["decision_ids"]) == 10
    dash = client.get("/api/dashboard").json()
    assert dash["datasets_audited"] == 2
    assert dash["recurring_matches"] >= 1
    assert dash["replays"] == 1
    assert dash["mean_auc_inflation"] == pytest.approx(-rep["result"]["auc_delta"])


def test_replay_unavailable_without_labels(client):
    csv = "decision_id,feature_name,prediction_time,available_time\nd1,x,2026-01-01T00:00:00Z,2026-01-02T00:00:00Z\n"
    a = client.post("/api/datasets", files={"file": ("tiny.csv", csv.encode(), "text/csv")}).json()
    rep = client.post(f"/api/audits/{a['id']}/replay").json()
    assert rep["status"] == "unavailable"
    assert "target" in rep["message"]


def test_sample_download(client):
    r = client.get("/api/samples/credit_default_clean.csv/download")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.text.startswith("decision_id,feature_name")
    assert client.get("/api/samples/../config.py/download").status_code == 404
    assert client.get("/api/samples/nope.csv/download").status_code == 404
