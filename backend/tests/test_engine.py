from pathlib import Path

import pytest

from engine.leakage_detector import detect_leakage
from engine.parsing import ParseError, parse_csv
from engine.replay import ReplayUnavailable, run_replay
from engine.risk_scoring import MemoryEvidence, score_dataset

SAMPLES = Path(__file__).resolve().parent.parent / "data" / "samples"

LONG_CSV = """decision_id,feature_name,feature_value,prediction_time,available_time,target,expected_status
d1,amount,10,2026-01-01T10:00:00,2026-01-01T09:00:00,0,LEAKAGE
d1,chargeback,1,2026-01-01T10:00:00,2026-01-08T10:00:00,1,SAFE
d2,amount,20,2026-01-02T10:00:00,2026-01-02T10:00:00,0,SAFE
d2,chargeback,0,2026-01-02T10:00:00,2026-01-02T08:00:00,0,SAFE
d3,amount,5,2026-01-03T10:00:00,,1,SAFE
"""

WIDE_CSV = """id,decision_time,label,score,score_available_at,outcome_flag,outcome_flag_available_time,notes_status
a,2026-02-01 12:00,1,0.3,2026-02-01 11:00,1,2026-02-03 12:00,SAFE
b,2026-02-02 12:00,0,0.1,2026-02-02 11:59,0,2026-02-02 11:00,SAFE
"""


def test_long_format_uses_timestamps_not_labels():
    ds = parse_csv(LONG_CSV)
    assert ds.layout == "long"
    assert "expected_status" in ds.ignored_columns
    audit = detect_leakage(ds)
    by = {f.feature: f for f in audit.feature_results}
    # expected_status claims "amount" leaked and "chargeback" is safe; timestamps say the opposite.
    assert by["amount"].status == "safe"
    assert by["chargeback"].status == "leaked"
    assert by["chargeback"].leaked == 1 and by["chargeback"].observations == 2
    assert by["chargeback"].leak_rate == 0.5
    assert by["chargeback"].delay_median_hours == pytest.approx(168.0)
    assert by["amount"].unverified == 1  # d3 has no availability timestamp
    assert audit.affected_decisions == 1
    assert audit.decisions == 3
    assert audit.affected_decision_ids == ["d1"]
    assert audit.timeline_decision_id == "d1"


def test_wide_format_detects_availability_columns():
    ds = parse_csv(WIDE_CSV)
    assert ds.layout == "wide"
    assert set(ds.features) == {"score", "outcome_flag"}
    assert "notes_status" in ds.ignored_columns
    audit = detect_leakage(ds)
    assert audit.leaked_features == ["outcome_flag"]
    assert audit.feature_results[0].delay_max_hours == pytest.approx(48.0)


def test_parse_errors_are_clear():
    with pytest.raises(ParseError, match="prediction timestamp"):
        parse_csv("a,b\n1,2\n")
    with pytest.raises(ParseError, match="availability timestamps"):
        parse_csv("decision_time,x\n2026-01-01,1\n")


def test_risk_scoring_and_memory_boost():
    audit = detect_leakage(parse_csv(LONG_CSV))
    base = score_dataset(audit)
    by = {f.feature: f for f in base.features}
    assert by["chargeback"].band in {"medium", "high"}
    assert by["amount"].score == 0
    mem = MemoryEvidence(1, "chargeback_result", "old.csv", 0.9, "lesson")
    boosted = score_dataset(audit, {"chargeback": mem})
    b = {f.feature: f for f in boosted.features}["chargeback"]
    assert b.memory_score == pytest.approx(13.5)
    assert b.label == "Recurring leakage"
    assert boosted.score > base.score
    # Weak similarity does not count as a match.
    weak = score_dataset(audit, {"chargeback": MemoryEvidence(1, "x", "old.csv", 0.3, "")})
    assert weak.score == base.score


def test_fraud_sample_detects_leaks_and_replay_measures_drop():
    ds = parse_csv((SAMPLES / "fraud_detection_q1.csv").read_bytes())
    audit = detect_leakage(ds)
    assert {"chargeback_filed", "settlement_status"} <= set(audit.leaked_features)
    assert "transaction_amount" not in audit.leaked_features
    risk = score_dataset(audit)
    assert risk.band == "high"
    replay = run_replay(ds, audit.leaked_features)
    assert replay.baseline.auc > replay.leak_free.auc + 0.1
    assert replay.test_size + replay.train_size == audit.decisions
    assert replay.train_period_end <= replay.test_period_start


def test_clean_sample_is_low_risk():
    ds = parse_csv((SAMPLES / "credit_default_clean.csv").read_bytes())
    audit = detect_leakage(ds)
    assert audit.leaked_features == []
    assert score_dataset(audit).score == 0
    replay = run_replay(ds, audit.leaked_features)
    assert replay.auc_delta == 0


def test_replay_requires_labels_and_size():
    ds = parse_csv(LONG_CSV)
    with pytest.raises(ReplayUnavailable, match="at least"):
        run_replay(ds, ["chargeback"])
    no_target = parse_csv(LONG_CSV.replace(",target,", ",tgt_x,"))
    with pytest.raises(ReplayUnavailable, match="target"):
        run_replay(no_target, [])
