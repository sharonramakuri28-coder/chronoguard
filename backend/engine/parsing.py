"""CSV parsing: turn an uploaded file into a normalized, engine-ready dataset.

Two layouts are supported and detected automatically:

* long  - one row per (decision, feature):
          decision_id, feature_name, feature_value, prediction_time, available_time, target
* wide  - one row per decision:
          decision_id, prediction_time, target, <feature>, <feature>_available_time, ...

Only timestamps decide leakage. Columns that look like hand-written verdicts
(``expected_status``, ``available_at_decision_time``, ``risk_level`` ...) are
never used by the engine; they are reported back as ignored.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import pandas as pd

PREDICTION_ALIASES = [
    "prediction_time",
    "prediction_timestamp",
    "prediction_date",
    "predicted_at",
    "decision_time",
    "decision_timestamp",
    "decision_date",
    "scored_at",
    "score_time",
]
AVAILABLE_ALIASES = [
    "available_time",
    "available_timestamp",
    "available_at",
    "feature_available_time",
    "feature_available_timestamp",
    "availability_time",
    "known_at",
    "published_at",
]
FEATURE_NAME_ALIASES = ["feature_name", "feature"]
VALUE_ALIASES = ["feature_value", "value"]
TARGET_ALIASES = ["target", "target_label", "label", "y", "outcome", "is_fraud", "class"]
ID_ALIASES = [
    "decision_id",
    "prediction_id",
    "transaction_id",
    "event_id",
    "row_id",
    "record_id",
    "entity_id",
    "id",
]
# Hand-labelled verdict columns. Never used as evidence or as model features.
IGNORED_ALIASES = [
    "expected_status",
    "status",
    "historical_status",
    "leakage",
    "is_leak",
    "leaked",
    "available_at_decision_time",
    "risk_level",
    "explanation",
    "experiment_id",
    "model_name",
    "source",
    "reported_accuracy",
    "reported_metric",
]
# Wide layout: per-feature availability column patterns.
_AVAIL_SUFFIX = re.compile(
    r"^(?P<f>.+?)(?:__|_)(?:available_time|available_at|available_timestamp|availability_time|known_at)$"
)
# Verdict-looking names (used only when the column has no availability timestamp of its own).
_VERDICT_LIKE = re.compile(r"(leak|expected|verdict|risk_level|(^|_)status$)")
_AVAIL_PREFIX = re.compile(r"^(?:available_time|available_at|availability_time|known_at)(?:__|_)(?P<f>.+)$")


class ParseError(ValueError):
    """Raised when a CSV cannot be interpreted as a temporal dataset."""


@dataclass
class ParsedDataset:
    layout: str  # "long" | "wide"
    observations: pd.DataFrame  # decision_id, feature, prediction_time, available_time (UTC; NaT = unknown)
    decisions: pd.DataFrame  # decision_id, prediction_time, target (optional) - one row per decision
    matrix: pd.DataFrame  # decision_id index, one column per feature (values for replay)
    column_mapping: dict[str, str | None]
    ignored_columns: list[str] = field(default_factory=list)
    invalid_rows: int = 0
    total_rows: int = 0

    @property
    def features(self) -> list[str]:
        return list(self.matrix.columns)

    @property
    def has_target(self) -> bool:
        return "target" in self.decisions.columns and self.decisions["target"].notna().any()


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(name).strip().lower()).strip("_")


def _find(columns: dict[str, str], aliases: list[str]) -> str | None:
    for alias in aliases:
        if alias in columns:
            return columns[alias]
    return None


def _to_utc(series: pd.Series) -> pd.Series:
    """Parse timestamps; naive values are treated as UTC. Unparseable -> NaT."""
    return pd.to_datetime(series, errors="coerce", utc=True, format="mixed")


def _coerce_values(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    # Keep numeric when every non-empty value parsed; otherwise treat as categorical.
    if numeric.notna().sum() >= series.notna().sum():
        return numeric.astype(float)
    return series.astype("string").astype("category")


def _encode_target(series: pd.Series) -> pd.Series:
    s = series.copy()
    numeric = pd.to_numeric(s, errors="coerce")
    if numeric.notna().sum() == s.notna().sum():
        return numeric
    lowered = s.astype("string").str.strip().str.lower()
    mapping = {
        "true": 1,
        "yes": 1,
        "1": 1,
        "fraud": 1,
        "positive": 1,
        "false": 0,
        "no": 0,
        "0": 0,
        "legit": 0,
        "negative": 0,
    }
    return lowered.map(mapping).astype(float)


def parse_csv(content: bytes | str) -> ParsedDataset:
    if isinstance(content, bytes):
        content = content.decode("utf-8-sig", errors="replace")
    try:
        raw = pd.read_csv(io.StringIO(content), dtype=str, keep_default_na=True, skipinitialspace=True)
    except (pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
        raise ParseError(f"Could not read CSV: {exc}") from exc
    if raw.empty:
        raise ParseError("The CSV has no data rows.")

    raw.columns = [str(c).strip() for c in raw.columns]
    cols = {_norm(c): c for c in raw.columns}

    pred_col = _find(cols, PREDICTION_ALIASES)
    if pred_col is None:
        raise ParseError(
            "No prediction timestamp column found. Expected one of: " + ", ".join(PREDICTION_ALIASES[:5]) + "."
        )
    feature_col = _find(cols, FEATURE_NAME_ALIASES)
    avail_col = _find(cols, AVAILABLE_ALIASES)

    if feature_col and avail_col:
        return _parse_long(raw, cols, pred_col, feature_col, avail_col)
    return _parse_wide(raw, cols, pred_col)


def _parse_long(raw: pd.DataFrame, cols: dict[str, str], pred_col: str, feature_col: str, avail_col: str):
    id_col = _find(cols, ID_ALIASES)
    value_col = _find(cols, VALUE_ALIASES)
    target_col = _find(cols, TARGET_ALIASES)
    used = {pred_col, feature_col, avail_col, id_col, value_col, target_col}
    ignored = [c for c in raw.columns if c not in used]

    if id_col is None:
        raise ParseError("Long-format CSV needs a decision id column (e.g. decision_id or transaction_id).")

    df = pd.DataFrame(
        {
            "decision_id": raw[id_col].astype("string").str.strip(),
            "feature": raw[feature_col].astype("string").str.strip(),
            "prediction_time": _to_utc(raw[pred_col]),
            "available_time": _to_utc(raw[avail_col]),
        }
    )
    total = len(df)
    valid = df["decision_id"].notna() & df["feature"].notna() & df["prediction_time"].notna()
    invalid = int((~valid).sum() + (valid & df["available_time"].isna()).sum())
    df = df[valid]
    obs = df.drop_duplicates(["decision_id", "feature"], keep="first").reset_index(drop=True)

    decisions = obs.groupby("decision_id", sort=False)["prediction_time"].min().to_frame()
    if target_col:
        targets = pd.DataFrame(
            {"decision_id": raw[id_col].astype("string").str.strip(), "target": _encode_target(raw[target_col])}
        )
        decisions = decisions.join(targets.dropna().drop_duplicates("decision_id").set_index("decision_id"))
    decisions = decisions.reset_index()

    if value_col:
        values = pd.DataFrame(
            {
                "decision_id": raw[id_col].astype("string").str.strip(),
                "feature": raw[feature_col].astype("string").str.strip(),
                "value": raw[value_col],
            }
        )[valid]
        matrix = values.drop_duplicates(["decision_id", "feature"]).pivot(
            index="decision_id", columns="feature", values="value"
        )
        matrix = matrix.apply(_coerce_values)
    else:
        matrix = pd.DataFrame(
            index=pd.Index(decisions["decision_id"], name="decision_id"), columns=sorted(obs["feature"].unique())
        )
    matrix = matrix.reindex(decisions["decision_id"])
    matrix.columns.name = None

    return ParsedDataset(
        layout="long",
        observations=obs,
        decisions=decisions,
        matrix=matrix,
        column_mapping={
            "decision_id": id_col,
            "feature_name": feature_col,
            "feature_value": value_col,
            "prediction_time": pred_col,
            "available_time": avail_col,
            "target": target_col,
        },
        ignored_columns=ignored,
        invalid_rows=invalid,
        total_rows=total,
    )


def _parse_wide(raw: pd.DataFrame, cols: dict[str, str], pred_col: str):
    id_col = _find(cols, ID_ALIASES)
    target_col = _find(cols, TARGET_ALIASES)

    avail_map: dict[str, str] = {}  # feature column -> availability column
    by_norm = {_norm(c): c for c in raw.columns}
    for c in raw.columns:
        m = _AVAIL_SUFFIX.match(_norm(c)) or _AVAIL_PREFIX.match(_norm(c))
        if m and m.group("f") in by_norm:
            avail_map[by_norm[m.group("f")]] = c

    reserved = {pred_col, id_col, target_col, *avail_map.values()}
    ignored = [
        c
        for c in raw.columns
        if c not in reserved and c not in avail_map and (_norm(c) in IGNORED_ALIASES or _VERDICT_LIKE.search(_norm(c)))
    ]
    features = [c for c in raw.columns if c not in reserved and c not in ignored]
    if not features:
        raise ParseError("No feature columns found.")
    if not avail_map:
        raise ParseError(
            "No feature availability timestamps found. Add '<feature>_available_time' columns "
            "(wide layout) or use the long layout with feature_name + available_time."
        )

    total = len(raw)
    ids = (
        raw[id_col].astype("string").str.strip()
        if id_col
        else pd.Series([f"row-{i + 1}" for i in range(total)], dtype="string")
    )
    pred = _to_utc(raw[pred_col])
    valid = ids.notna() & pred.notna()

    decisions = pd.DataFrame({"decision_id": ids, "prediction_time": pred})
    if target_col:
        decisions["target"] = _encode_target(raw[target_col])
    decisions = decisions[valid].drop_duplicates("decision_id").reset_index(drop=True)
    keep = valid & ~ids.duplicated()

    frames = []
    invalid = int((~valid).sum())
    for f in features:
        avail = (
            _to_utc(raw[avail_map[f]])
            if f in avail_map
            else pd.Series(pd.NaT, index=raw.index, dtype="datetime64[ns, UTC]")
        )
        if f in avail_map:
            invalid += int((keep & avail.isna()).sum())
        frames.append(
            pd.DataFrame(
                {"decision_id": ids[keep], "feature": f, "prediction_time": pred[keep], "available_time": avail[keep]}
            )
        )
    obs = pd.concat(frames, ignore_index=True)
    obs["feature"] = obs["feature"].astype("string")

    matrix = raw.loc[keep, features].copy()
    matrix.index = pd.Index(ids[keep], name="decision_id")
    matrix = matrix.apply(_coerce_values)
    matrix.columns.name = None

    return ParsedDataset(
        layout="wide",
        observations=obs,
        decisions=decisions,
        matrix=matrix,
        column_mapping={
            "decision_id": id_col,
            "prediction_time": pred_col,
            "target": target_col,
            **{f"{f} (available)": a for f, a in avail_map.items()},
        },
        ignored_columns=ignored,
        invalid_rows=invalid,
        total_rows=total,
    )
