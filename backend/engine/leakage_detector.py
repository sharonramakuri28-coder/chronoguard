"""Timestamp-based leakage detection.

The only rule: a feature value leaks when ``available_time > prediction_time``,
i.e. the model was given information that did not exist yet when the
prediction was made. Everything reported here is computed from timestamps.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from engine.parsing import ParsedDataset

DELAY_BUCKETS: list[tuple[str, float, float]] = [
    ("In time", -np.inf, 0.0),
    ("<1 h", 0.0, 1.0),
    ("1–24 h", 1.0, 24.0),
    ("1–7 d", 24.0, 168.0),
    ("7–30 d", 168.0, 720.0),
    (">30 d", 720.0, np.inf),
]


def format_duration(hours: float) -> str:
    hours = abs(float(hours))
    if hours < 1:
        return f"{max(1, round(hours * 60))} min"
    if hours < 48:
        return f"{hours:.1f} h"
    return f"{hours / 24:.1f} days"


@dataclass
class LeakExample:
    decision_id: str
    prediction_time: str
    available_time: str
    delay_hours: float


@dataclass
class FeatureLeakage:
    feature: str
    status: str  # "leaked" | "safe" | "unverified"
    observations: int  # observations with both timestamps
    unverified: int  # observations without an availability timestamp
    leaked: int
    leak_rate: float  # leaked / observations
    delay_min_hours: float | None
    delay_median_hours: float | None
    delay_p90_hours: float | None
    delay_max_hours: float | None
    lead_median_hours: float | None  # how long before prediction the value was typically available
    reason: str
    worst_example: LeakExample | None
    delay_histogram: list[int]


@dataclass
class TimelineEvent:
    feature: str
    offset_hours: float | None  # available_time - prediction_time; None if unknown
    available_time: str | None
    leaked: bool


@dataclass
class AuditResult:
    decisions: int
    observations: int
    features: int
    leaked_features: list[str]
    affected_decisions: int
    affected_decision_rate: float
    leaked_observations: int
    observation_leak_rate: float
    period_start: str | None
    period_end: str | None
    feature_results: list[FeatureLeakage]
    delay_buckets: list[str]
    delay_histogram: list[int]
    timeline_decision_id: str | None
    timeline_prediction_time: str | None
    timeline: list[TimelineEvent]
    affected_decision_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _iso(ts) -> str | None:
    return None if ts is None or pd.isna(ts) else pd.Timestamp(ts).isoformat()


def _histogram(delays: pd.Series) -> list[int]:
    return [
        int(((delays > lo) & (delays <= hi)).sum()) if lo > -np.inf else int((delays <= hi).sum())
        for _, lo, hi in DELAY_BUCKETS
    ]


def _reason(f: FeatureLeakage) -> str:
    if f.status == "unverified":
        return "No availability timestamp was provided, so ChronoGuard cannot verify this feature."
    if f.status == "safe":
        lead = f" (typically {format_duration(f.lead_median_hours)} earlier)" if f.lead_median_hours else ""
        return f"Available at or before prediction time in all {f.observations:,} decisions{lead}."
    return (
        f"Became available after the prediction in {f.leaked:,} of {f.observations:,} decisions "
        f"({f.leak_rate:.1%}). Median delay {format_duration(f.delay_median_hours)}, "
        f"up to {format_duration(f.delay_max_hours)} after the prediction was made."
    )


def detect_leakage(ds: ParsedDataset) -> AuditResult:
    obs = ds.observations.copy()
    obs["delay_hours"] = (obs["available_time"] - obs["prediction_time"]).dt.total_seconds() / 3600.0
    obs["has_ts"] = obs["available_time"].notna()
    obs["leaked"] = obs["has_ts"] & (obs["delay_hours"] > 0)

    results: list[FeatureLeakage] = []
    for feature in ds.features:
        g = obs[obs["feature"] == feature]
        timed = g[g["has_ts"]]
        leaked = timed[timed["leaked"]]
        safe = timed[~timed["leaked"]]
        n, k = len(timed), len(leaked)
        status = "unverified" if n == 0 else ("leaked" if k > 0 else "safe")
        worst = None
        if k:
            row = leaked.loc[leaked["delay_hours"].idxmax()]
            worst = LeakExample(
                str(row["decision_id"]),
                _iso(row["prediction_time"]),
                _iso(row["available_time"]),
                round(float(row["delay_hours"]), 3),
            )
        d = leaked["delay_hours"]
        fl = FeatureLeakage(
            feature=feature,
            status=status,
            observations=n,
            unverified=int(len(g) - n),
            leaked=k,
            leak_rate=round(k / n, 6) if n else 0.0,
            delay_min_hours=round(float(d.min()), 3) if k else None,
            delay_median_hours=round(float(d.median()), 3) if k else None,
            delay_p90_hours=round(float(d.quantile(0.9)), 3) if k else None,
            delay_max_hours=round(float(d.max()), 3) if k else None,
            lead_median_hours=round(float(-safe["delay_hours"].median()), 3) if len(safe) else None,
            reason="",
            worst_example=worst,
            delay_histogram=_histogram(timed["delay_hours"]),
        )
        fl.reason = _reason(fl)
        results.append(fl)

    leaked_obs = obs[obs["leaked"]]
    affected_ids = leaked_obs["decision_id"].drop_duplicates()
    n_decisions = len(ds.decisions)
    timed_obs = obs[obs["has_ts"]]

    # Representative decision for the timeline: the one with the most leaked features (earliest on ties).
    timeline: list[TimelineEvent] = []
    tl_id = tl_pred = None
    if len(obs):
        if len(leaked_obs):
            counts = leaked_obs.groupby("decision_id")["feature"].nunique()
            best = counts[counts == counts.max()].index
            candidates = ds.decisions[ds.decisions["decision_id"].isin(best)]
        else:
            candidates = ds.decisions
        first = candidates.sort_values("prediction_time").iloc[0]
        tl_id, tl_pred = str(first["decision_id"]), _iso(first["prediction_time"])
        for _, r in obs[obs["decision_id"] == first["decision_id"]].sort_values("delay_hours").iterrows():
            timeline.append(
                TimelineEvent(
                    feature=str(r["feature"]),
                    offset_hours=None if pd.isna(r["delay_hours"]) else round(float(r["delay_hours"]), 3),
                    available_time=_iso(r["available_time"]),
                    leaked=bool(r["leaked"]),
                )
            )

    ordered = sorted(results, key=lambda f: ({"leaked": 0, "unverified": 1, "safe": 2}[f.status], -f.leak_rate))
    return AuditResult(
        decisions=n_decisions,
        observations=int(len(timed_obs)),
        features=len(results),
        leaked_features=[f.feature for f in ordered if f.status == "leaked"],
        affected_decisions=int(len(affected_ids)),
        affected_decision_rate=round(len(affected_ids) / n_decisions, 6) if n_decisions else 0.0,
        leaked_observations=int(len(leaked_obs)),
        observation_leak_rate=round(len(leaked_obs) / len(timed_obs), 6) if len(timed_obs) else 0.0,
        period_start=_iso(ds.decisions["prediction_time"].min()) if n_decisions else None,
        period_end=_iso(ds.decisions["prediction_time"].max()) if n_decisions else None,
        feature_results=ordered,
        delay_buckets=[b[0] for b in DELAY_BUCKETS],
        delay_histogram=_histogram(timed_obs["delay_hours"]),
        timeline_decision_id=tl_id,
        timeline_prediction_time=tl_pred,
        timeline=timeline,
        affected_decision_ids=[str(x) for x in affected_ids.tolist()],
    )
