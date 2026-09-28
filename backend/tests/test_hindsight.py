"""Hindsight adapter: retain/recall through real API flows, failure fallback and health states.

A fake ``hindsight_client`` module stands in for the real package, so no network is used.
"""

import asyncio
import sys
import time
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import memory.hindsight_adapter as ha
from config import get_settings
from main import app

SAMPLES = Path(__file__).resolve().parent.parent / "data" / "samples"
RECALLED = "In fraud_detection_q1.csv, 'chargeback_filed' became available after scoring."


class HttpError(Exception):
    def __init__(self, status: int):
        super().__init__(f"HTTP {status}")
        self.status = status


def make_fake(retain_error=None, recall_error=None, probe_error=None, probe_delay=0.0):
    """A fresh fake Hindsight class per test, recording every call."""

    def no_running_loop():
        # Like the real client, whose sync wrappers fail inside a running event loop.
        if asyncio._get_running_loop() is not None:
            raise RuntimeError("This event loop is already running")

    class FakeHindsight:
        created: list[dict] = []
        calls: list[tuple] = []
        retain_kwargs: list[dict] = []
        closed = 0

        def __init__(self, base_url, api_key=None, timeout=300.0):
            FakeHindsight.created.append({"base_url": base_url, "api_key": api_key, "timeout": timeout})

        def retain(self, bank_id, content, context=None, **kwargs):
            no_running_loop()
            FakeHindsight.calls.append(("retain", bank_id, content))
            FakeHindsight.retain_kwargs.append(kwargs)
            if retain_error:
                raise retain_error

        def reflect(self, bank_id, query, **kwargs):
            no_running_loop()
            FakeHindsight.calls.append(("reflect", bank_id, query))
            if recall_error:
                raise recall_error
            return SimpleNamespace(text=f"Reflection: {RECALLED}")

        def recall(self, bank_id, query):
            no_running_loop()
            FakeHindsight.calls.append(("recall", bank_id, query))
            if recall_error:
                raise recall_error
            return SimpleNamespace(results=[SimpleNamespace(text=RECALLED)])

        def list_memories(self, bank_id, limit=100):
            no_running_loop()
            FakeHindsight.calls.append(("list_memories", bank_id, limit))
            time.sleep(probe_delay)
            if probe_error:
                raise probe_error
            return SimpleNamespace(items=[])

        def close(self):
            FakeHindsight.closed += 1

    return FakeHindsight


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def enable_hindsight(monkeypatch):
    """Configure Hindsight with a unique bank (isolates the shared connectivity cache) and a fake client."""
    ha._reset_state()

    def _enable(fake):
        settings = get_settings().model_copy(
            update={
                "hindsight_base_url": "https://hindsight.example",
                "hindsight_api_key": "test-key",
                "hindsight_bank_id": f"test-{uuid.uuid4().hex[:8]}",
            }
        )
        monkeypatch.setattr(ha, "get_settings", lambda: settings)
        monkeypatch.setitem(sys.modules, "hindsight_client", SimpleNamespace(Hindsight=fake))
        return fake

    yield _enable
    ha._reset_state()


def _upload(client, sample: str, name: str) -> dict:
    r = client.post("/api/datasets", files={"file": (name, (SAMPLES / sample).read_bytes(), "text/csv")})
    assert r.status_code == 201, r.text
    return r.json()


def test_retain_success_marks_incidents_and_uses_timeout(client, enable_hindsight):
    fake = enable_hindsight(make_fake())
    name = f"hs_retain_{uuid.uuid4().hex[:6]}.csv"
    audit = _upload(client, "fraud_detection_q1.csv", name)

    retained = [c for c in fake.calls if c[0] == "retain"]
    assert len(retained) == len(audit["leaked_features"])
    # A structured incident record: cause, timeline evidence, fix and lesson, upserted per incident.
    assert all(c[2].startswith("ChronoGuard incident: Temporal leakage") for c in retained)
    assert all(f"(dataset {name})" in c[2] and "\nFix: " in c[2] and "\nLesson: " in c[2] for c in retained)
    kwargs = fake.retain_kwargs
    assert all(k["update_mode"] == "replace" and k["document_id"].startswith("chronoguard-incident-") for k in kwargs)
    assert all(k["metadata"]["dataset"] == name and "temporal-leakage" in k["tags"] for k in kwargs)
    assert all(inst["timeout"] == get_settings().hindsight_timeout_seconds for inst in fake.created)

    incidents = [i for i in client.get("/api/memory/incidents").json() if i["dataset_name"] == name]
    assert incidents and all(i["hindsight_retained"] for i in incidents)
    assert client.get("/api/health").json()["hindsight"] == ha.CONNECTED
    assert fake.closed == len(fake.created)  # every per-request client released its HTTP session


def test_recall_success_in_audit_and_memory_search(client, enable_hindsight):
    fake = enable_hindsight(make_fake())
    audit = _upload(client, "fraud_detection_q2_wide.csv", f"hs_recall_{uuid.uuid4().hex[:6]}.csv")
    assert audit["hindsight_context"] == [RECALLED]
    assert any(c[0] == "recall" and "cb_resolution_flag" in c[2] for c in fake.calls)

    search = client.post("/api/memory/search", json={"query": "chargeback"}).json()
    assert search["hindsight"] == [RECALLED]


def test_hindsight_failure_falls_back_to_local_memory(client, enable_hindsight):
    # Local memory needs an earlier incident to match against (Hindsight disabled for this part).
    ha._reset_state()
    base = f"hs_base_{uuid.uuid4().hex[:6]}.csv"
    _upload(client, "fraud_detection_q1.csv", base)

    enable_hindsight(make_fake(retain_error=HttpError(503), recall_error=ConnectionError("unreachable")))
    name = f"hs_fail_{uuid.uuid4().hex[:6]}.csv"
    audit = _upload(client, "fraud_detection_q2_wide.csv", name)  # must still succeed

    assert audit["hindsight_context"] == []
    assert {"cb_resolution_flag", "payment_final_state"} <= set(audit["leaked_features"])
    risk = {f["feature"]: f for f in audit["risk"]["features"]}
    assert risk["cb_resolution_flag"]["label"] == "Recurring leakage"  # local vector memory still works
    # Matched from local incidents (another test may have stored an exact-name incident first).
    assert risk["cb_resolution_flag"]["memory"]["feature"] in {"chargeback_filed", "cb_resolution_flag"}

    incidents = [i for i in client.get("/api/memory/incidents").json() if i["dataset_name"] == name]
    assert incidents and not any(i["hindsight_retained"] for i in incidents)
    search = client.post("/api/memory/search", json={"query": "chargeback"})
    assert search.status_code == 200 and search.json()["hindsight"] == []

    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert health["hindsight"] == ha.CONNECTION_FAILED
    assert health["hindsight_detail"]


def test_health_disabled_without_credentials(client):
    ha._reset_state()
    body = client.get("/api/health").json()
    assert body["hindsight"] == ha.DISABLED


def test_health_package_missing(client, enable_hindsight, monkeypatch):
    enable_hindsight(make_fake())
    monkeypatch.setitem(sys.modules, "hindsight_client", None)  # makes the import fail
    body = client.get("/api/health").json()
    assert body["hindsight"] == ha.PACKAGE_MISSING
    assert "not installed" in body["hindsight_detail"]


@pytest.mark.parametrize(
    ("probe_error", "expected", "detail"),
    [
        (None, ha.CONNECTED, None),
        (HttpError(404), ha.CONNECTED, "not created yet"),
        (HttpError(401), ha.CONNECTION_FAILED, "rejected the API key"),
        (ConnectionError("refused"), ha.CONNECTION_FAILED, "Could not reach"),
    ],
)
def test_health_probe_states(client, enable_hindsight, probe_error, expected, detail):
    fake = enable_hindsight(make_fake(probe_error=probe_error))
    body = client.get("/api/health").json()
    assert body["hindsight"] == expected
    assert (body["hindsight_detail"] is None) if detail is None else (detail in body["hindsight_detail"])
    probe = next(i for i in fake.created if i["timeout"] == ha.PROBE_TIMEOUT_SECONDS)
    assert probe["api_key"] == "test-key"
    # A second call within the cache window does not probe again.
    probes = sum(c[0] == "list_memories" for c in fake.calls)
    client.get("/api/health")
    assert sum(c[0] == "list_memories" for c in fake.calls) == probes


def test_health_stays_fast_when_hindsight_is_slow(client, enable_hindsight):
    enable_hindsight(make_fake(probe_delay=3.0))
    start = time.monotonic()
    body = client.get("/api/health").json()
    assert time.monotonic() - start < ha.PROBE_WAIT_SECONDS + 1.0
    assert body["hindsight"] == ha.CONFIGURED


def test_failure_backs_off_instead_of_retrying_every_call(client, enable_hindsight):
    fake = enable_hindsight(make_fake(retain_error=HttpError(503)))
    audit = _upload(client, "fraud_detection_q1.csv", f"hs_backoff_{uuid.uuid4().hex[:6]}.csv")
    assert len(audit["leaked_features"]) > 1
    # The first retain fails; the remaining ones are skipped instead of each waiting for a timeout.
    assert sum(c[0] == "retain" for c in fake.calls) == 1
    recalls = sum(c[0] == "recall" for c in fake.calls)
    assert client.post("/api/memory/search", json={"query": "chargeback"}).json()["hindsight"] == []
    assert sum(c[0] == "recall" for c in fake.calls) == recalls  # skipped during the backoff window


def test_feedback_re_retains_and_chat_reflects(client, enable_hindsight):
    fake = enable_hindsight(make_fake())
    audit = _upload(client, "fraud_detection_q1.csv", f"hs_learn_{uuid.uuid4().hex[:6]}.csv")
    first = [k["document_id"] for k in fake.retain_kwargs]

    r = client.post(f"/api/audits/{audit['id']}/feedback", json={"successful": False, "note": "still leaking"})
    assert r.status_code == 200 and r.json()["hindsight_synced"] >= len(audit["leaked_features"])
    replaced = [k for k in fake.retain_kwargs[len(first) :] if k["document_id"] in first]
    assert replaced and all(k["metadata"]["fix_rejections"] == "1" for k in replaced)  # same documents, updated
    assert any("rejected 1 time(s)" in c[2] for c in fake.calls if c[0] == "retain")

    chat = client.post("/api/chat", json={"message": "Have we seen this before?", "audit_id": audit["id"]}).json()
    assert chat["provider"] == "hindsight-reflect" and "Hindsight reflection" in chat["answer"]
    assert any(c[0] == "reflect" for c in fake.calls)
    assert (
        client.post("/api/hindsight/reflect", json={"query": "chargebacks"}).json()["answer"].startswith("Reflection")
    )
