"""Risk scoring: combine timestamp evidence with memory of past incidents.

Feature score (0-100)
    timestamp component = 100 * sqrt(leak_rate) * severity
        severity = 0.5 + 0.5 * min(1, log1p(median_delay_h) / log1p(720))
        (any confirmed leak is at least "medium"; a 30-day median delay is maximal)
    memory component    = up to +15 when a similar past incident is found
                          (scaled by similarity). For features with no
                          availability timestamps, a memory match alone gives
                          up to 45, i.e. "needs review".

Dataset score = 0.7 * max(feature scores) + 0.3 * mean(scores of risky features)

Bands: 0-24 low, 25-59 medium, 60-100 high.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

from engine.leakage_detector import AuditResult, FeatureLeakage

MAX_SEVERITY_HOURS = 720.0
MEMORY_BOOST = 15.0
MEMORY_ONLY_CAP = 45.0
MIN_SIMILARITY = 0.5

FORMULA = (
    "feature = 100 × √(leak rate) × severity(median delay) + memory boost (≤15); "
    "dataset = 0.7 × max feature + 0.3 × mean of risky features"
)


@dataclass
class MemoryEvidence:
    incident_id: int
    feature: str
    dataset_name: str
    similarity: float
    lesson: str


@dataclass
class FeatureRisk:
    feature: str
    score: float
    band: str
    label: str
    timestamp_score: float
    memory_score: float
    memory: MemoryEvidence | None


@dataclass
class RiskResult:
    score: float
    band: str
    formula: str
    features: list[FeatureRisk]

    def to_dict(self) -> dict:
        return asdict(self)


def band(score: float) -> str:
    return "high" if score >= 60 else "medium" if score >= 25 else "low"


def severity(median_delay_hours: float | None) -> float:
    if not median_delay_hours or median_delay_hours <= 0:
        return 0.5
    return 0.5 + 0.5 * min(1.0, math.log1p(median_delay_hours) / math.log1p(MAX_SEVERITY_HOURS))


def timestamp_score(f: FeatureLeakage) -> float:
    if f.status != "leaked":
        return 0.0
    return 100.0 * math.sqrt(f.leak_rate) * severity(f.delay_median_hours)


def score_feature(f: FeatureLeakage, memory: MemoryEvidence | None) -> FeatureRisk:
    ts = timestamp_score(f)
    match = memory if memory and memory.similarity >= MIN_SIMILARITY else None
    mem = 0.0
    if match:
        mem = (MEMORY_ONLY_CAP if f.status == "unverified" else MEMORY_BOOST) * match.similarity
        if f.status == "safe":
            mem = 0.0  # timestamps prove it is safe here; memory is shown as context only
    score = round(min(100.0, ts + mem), 1)

    if f.status == "leaked":
        label = "Recurring leakage" if match else "New leakage"
    elif f.status == "unverified":
        label = "Review: matches past incident" if match else "Unverified"
    else:
        label = "Safe (similar name to a past incident)" if match else "Safe"
    return FeatureRisk(f.feature, score, band(score), label, round(ts, 1), round(mem, 1), match)


def score_dataset(audit: AuditResult, memory: dict[str, MemoryEvidence] | None = None) -> RiskResult:
    memory = memory or {}
    features = [score_feature(f, memory.get(f.feature)) for f in audit.feature_results]
    scores = [f.score for f in features]
    risky = [s for s in scores if s > 0]
    total = 0.0 if not risky else 0.7 * max(scores) + 0.3 * (sum(risky) / len(risky))
    total = round(min(100.0, total), 1)
    features.sort(key=lambda f: -f.score)
    return RiskResult(score=total, band=band(total), formula=FORMULA, features=features)
