"""Generate the bundled synthetic demo datasets (deterministic, seeded).

Run from backend/:  python -m scripts.generate_samples

The data is synthetic. It simulates a common real-world mistake: features that
are only recorded after the outcome (chargebacks, settlement results) end up in
the training table, get joined on transaction id, and silently leak the label.
Nothing here stores a leakage verdict; ChronoGuard must find it from timestamps.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "data" / "samples"
START = pd.Timestamp("2026-01-01T00:00:00Z")


def _fraud_base(rng: np.random.Generator, n: int, id_prefix: str) -> pd.DataFrame:
    pred = START + pd.to_timedelta(np.sort(rng.uniform(0, 180 * 24, n)), unit="h")
    latent = rng.normal(0, 1, n)
    fraud = (latent + rng.normal(0, 0.9, n) > 1.85).astype(int)
    df = pd.DataFrame(
        {
            "decision_id": [f"{id_prefix}-{i:05d}" for i in range(n)],
            "prediction_time": pred.round("min"),
            "target": fraud,
            "transaction_amount": np.round(np.exp(rng.normal(3.8, 0.9, n)) * (1 + 0.6 * latent.clip(0)), 2),
            "customer_risk_score": np.round((0.35 * latent + rng.normal(0, 1, n)) * 12 + 50, 1),
            "device_risk_score": np.round((0.3 * latent + rng.normal(0, 1, n)) * 10 + 40, 1),
            "transaction_velocity": rng.poisson(np.exp(0.8 + 0.25 * latent)),
            "merchant_risk_score": np.round((0.25 * latent + rng.normal(0, 1, n)) * 8 + 30, 1),
        }
    )
    # Post-outcome signals: recorded days after the decision, and strongly tied to the label.
    df["chargeback_filed"] = np.where(fraud == 1, rng.random(n) < 0.9, rng.random(n) < 0.02).astype(int)
    df["settlement_status"] = np.where(
        fraud == 1, rng.choice([0, 1, 2], n, p=[0.1, 0.2, 0.7]), rng.choice([0, 1, 2], n, p=[0.85, 0.12, 0.03])
    )
    return df


def _availability(rng: np.random.Generator, df: pd.DataFrame) -> dict[str, pd.Series]:
    n = len(df)
    p = df["prediction_time"]
    h = lambda x: pd.to_timedelta(x, unit="h")  # noqa: E731
    merchant_late = rng.random(n) < 0.12  # nightly batch job sometimes finishes after scoring
    return {
        "transaction_amount": p,
        "customer_risk_score": p - h(rng.uniform(0.05, 6, n)),
        "device_risk_score": p - h(rng.uniform(0.01, 0.5, n)),
        "transaction_velocity": p - h(rng.uniform(0.01, 1, n)),
        "merchant_risk_score": np.where(merchant_late, p + h(rng.uniform(1, 9, n)), p - h(rng.uniform(1, 20, n))),
        "chargeback_filed": p + h(rng.uniform(3 * 24, 10 * 24, n)),
        "settlement_status": p + h(rng.uniform(24, 3 * 24, n)),
    }


def _to_long(df: pd.DataFrame, avail: dict[str, pd.Series], rename: dict[str, str] | None = None) -> pd.DataFrame:
    rename = rename or {}
    frames = []
    for feature, when in avail.items():
        frames.append(
            pd.DataFrame(
                {
                    "decision_id": df["decision_id"],
                    "feature_name": rename.get(feature, feature),
                    "feature_value": df[feature],
                    "prediction_time": df["prediction_time"],
                    "available_time": pd.Series(when, index=df.index).dt.round("min"),
                    "target": df["target"],
                }
            )
        )
    out = pd.concat(frames).sort_values(["prediction_time", "decision_id", "feature_name"], kind="stable")
    for col in ("prediction_time", "available_time"):
        out[col] = out[col].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return out


def fraud_v1(rng) -> pd.DataFrame:
    df = _fraud_base(rng, 4000, "TXN")
    return _to_long(df, _availability(rng, df))


def fraud_v2_wide(rng) -> pd.DataFrame:
    """Next quarter's model: same leak, renamed columns, wide layout."""
    df = _fraud_base(rng, 3000, "TX2")
    avail = _availability(rng, df)
    rename = {"chargeback_filed": "cb_resolution_flag", "settlement_status": "payment_final_state"}
    out = pd.DataFrame(
        {
            "transaction_id": df["decision_id"],
            "scored_at": df["prediction_time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "is_fraud": df["target"],
        }
    )
    for feature, when in avail.items():
        name = rename.get(feature, feature)
        out[name] = df[feature]
        out[f"{name}_available_time"] = (
            pd.Series(when, index=df.index).dt.round("min").dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        )
    return out


def credit_clean(rng) -> pd.DataFrame:
    """A correctly built credit-default dataset: every feature is known before the decision."""
    n = 2500
    pred = START + pd.to_timedelta(np.sort(rng.uniform(0, 150 * 24, n)), unit="h")
    latent = rng.normal(0, 1, n)
    default = (latent + rng.normal(0, 1.0, n) > 1.6).astype(int)
    df = pd.DataFrame(
        {
            "decision_id": [f"APP-{i:05d}" for i in range(n)],
            "prediction_time": pred.round("min"),
            "target": default,
            "income": np.round(np.exp(rng.normal(10.8, 0.4, n) - 0.15 * latent), 0),
            "debt_to_income": np.round((0.35 + 0.08 * latent + rng.normal(0, 0.08, n)).clip(0.01, 1.5), 3),
            "credit_utilization": np.round((0.4 + 0.12 * latent + rng.normal(0, 0.15, n)).clip(0, 1), 3),
            "months_employed": rng.integers(0, 240, n),
            "prior_delinquencies": rng.poisson(np.exp(-0.8 + 0.5 * latent)),
        }
    )
    h = lambda x: pd.to_timedelta(x, unit="h")  # noqa: E731
    p = df["prediction_time"]
    avail = {
        "income": p - h(rng.uniform(24, 24 * 30, n)),
        "debt_to_income": p - h(rng.uniform(1, 72, n)),
        "credit_utilization": p - h(rng.uniform(1, 48, n)),
        "months_employed": p - h(rng.uniform(24, 24 * 14, n)),
        "prior_delinquencies": p - h(rng.uniform(2, 96, n)),
    }
    return _to_long(df, avail)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20260928)
    datasets = {
        "fraud_detection_q1.csv": fraud_v1(rng),
        "fraud_detection_q2_wide.csv": fraud_v2_wide(rng),
        "credit_default_clean.csv": credit_clean(rng),
    }
    for name, frame in datasets.items():
        frame.to_csv(OUT / name, index=False)
        print(f"{name}: {len(frame):,} rows")


if __name__ == "__main__":
    main()
