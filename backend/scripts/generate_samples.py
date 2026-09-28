"""Generate the bundled synthetic datasets (deterministic, seeded).

Run from backend/:  python -m scripts.generate_samples

All data is synthetic. It simulates a common real-world mistake: fields that are only
recorded after the outcome (confirmed fraud, final payment state, investigation results,
chargeback resolutions) get joined into the training table on transaction id and silently
leak the label. No file stores a leakage verdict: ChronoGuard must find it from timestamps.

Datasets
- fraud_model_v1.csv          demo scene 1: first card-fraud model, 4 post-outcome leaks
- fraud_model_v2.csv          demo scene 3: next iteration, same leaks under new column names
- retail_demand_forecast.csv  seeded history: an earlier forecasting incident
- credit_default_clean.csv    seeded history: a correctly built dataset (no leakage)
- fraud_detection_q1.csv / fraud_detection_q2_wide.csv  earlier, smaller samples (kept)
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "data" / "samples"
START = pd.Timestamp("2026-01-01T00:00:00Z")
ISO = "%Y-%m-%dT%H:%M:%SZ"


def _h(x) -> pd.TimedeltaIndex:
    return pd.to_timedelta(x, unit="h")


def _iso(values) -> pd.Series:
    return pd.Series(values).dt.round("s").dt.strftime(ISO)


# ---------------------------------------------------------------------------- card fraud (demo)
PAYMENT_METHODS = ["card_present", "card_not_present", "wallet", "bank_transfer"]
MERCHANT_CATEGORIES = ["electronics", "grocery", "travel", "fashion", "gaming", "digital_goods", "restaurants"]


def card_fraud(rng: np.random.Generator, n: int, start: pd.Timestamp, leak_names: dict[str, str]) -> pd.DataFrame:
    """Wide layout, one row per scored transaction, with an availability timestamp per feature.

    ``leak_names`` maps the canonical post-outcome fields to the column names this team used.
    """
    pred = start + _h(np.sort(rng.uniform(0, 75 * 24, n)))
    customers = rng.integers(10_000, 10_000 + n // 3, n)
    merchants = rng.integers(500, 500 + 400, n)
    method = rng.choice(PAYMENT_METHODS, n, p=[0.35, 0.45, 0.15, 0.05])
    category = rng.choice(MERCHANT_CATEGORIES, n, p=[0.16, 0.24, 0.1, 0.16, 0.1, 0.12, 0.12])

    # Latent fraud propensity: only partly visible through features known at scoring time.
    latent = (
        rng.normal(0, 1, n)
        + 0.7 * (method == "card_not_present")
        + 0.8 * np.isin(category, ["digital_goods", "gaming", "electronics"])
    )
    fraud = (latent + rng.normal(0, 0.9, n) > 2.5).astype(int)

    amount = np.round(np.exp(rng.normal(3.9, 0.95, n)) * (1 + 0.35 * latent.clip(0)), 2)
    df = pd.DataFrame(
        {
            "transaction_id": [f"TX-{start:%y%m}-{i:06d}" for i in range(n)],
            "customer_id": [f"C{c}" for c in customers],
            "merchant_id": [f"M{m}" for m in merchants],
            "prediction_timestamp": _iso(pred),
            "transaction_timestamp": _iso(pred - pd.to_timedelta(rng.uniform(1, 120, n), unit="s")),
            "transaction_amount": amount,
            "merchant_risk_score": np.round((0.45 * latent + rng.normal(0, 1, n)) * 9 + 35, 1),
            "customer_risk_score": np.round((0.55 * latent + rng.normal(0, 1, n)) * 12 + 50, 1),
            "device_risk_score": np.round((0.5 * latent + rng.normal(0, 1, n)) * 10 + 40, 1),
            "ip_risk_score": np.round((0.45 * latent + rng.normal(0, 1, n)) * 11 + 30, 1),
            "transaction_velocity": rng.poisson(np.exp(0.7 + 0.3 * latent.clip(-2, 3))),
            "payment_method": method,
            "merchant_category": category,
            "incident_history": rng.poisson(np.exp(-1.2 + 0.35 * latent.clip(-2, 3))),
        }
    )

    # Post-outcome fields: recorded days to weeks after scoring, and tightly coupled to the label.
    confirmed = np.where(fraud == 1, rng.random(n) < 0.93, rng.random(n) < 0.01).astype(int)
    final_state = np.where(
        fraud == 1,
        rng.choice(["reversed", "disputed", "settled"], n, p=[0.55, 0.35, 0.10]),
        rng.choice(["settled", "disputed", "reversed"], n, p=[0.94, 0.04, 0.02]),
    )
    investigation = np.where(
        fraud == 1,
        rng.choice(["confirmed_fraud", "inconclusive", "cleared"], n, p=[0.8, 0.15, 0.05]),
        rng.choice(["not_investigated", "cleared", "inconclusive"], n, p=[0.9, 0.08, 0.02]),
    )
    chargeback = np.where(fraud == 1, rng.random(n) < 0.85, rng.random(n) < 0.02).astype(int)
    leaks = {
        "fraud_confirmed": confirmed,
        "payment_final_state": final_state,
        "investigation_result": investigation,
        "cb_resolution_flag": chargeback,
    }
    for canonical, values in leaks.items():
        df[leak_names[canonical]] = values
    df["fraud_label"] = fraud

    # When each value became available, relative to the moment of scoring.
    p = pd.Series(pred)
    merchant_late = rng.random(n) < 0.12  # nightly merchant-risk batch sometimes lands after scoring
    availability = {
        "transaction_amount": p - pd.to_timedelta(rng.uniform(1, 120, n), unit="s"),
        "merchant_risk_score": p + _h(np.where(merchant_late, rng.uniform(1, 9, n), -rng.uniform(1, 20, n))),
        "customer_risk_score": p - _h(rng.uniform(0.05, 6, n)),
        "device_risk_score": p - _h(rng.uniform(0.001, 0.2, n)),
        "ip_risk_score": p - _h(rng.uniform(0.001, 0.1, n)),
        "transaction_velocity": p - _h(rng.uniform(0.01, 1, n)),
        "payment_method": p - pd.to_timedelta(rng.uniform(1, 120, n), unit="s"),
        "merchant_category": p - _h(rng.uniform(24, 24 * 90, n)),
        "incident_history": p - _h(rng.uniform(1, 24, n)),
        leak_names["fraud_confirmed"]: p + _h(rng.uniform(5 * 24, 20 * 24, n)),
        leak_names["payment_final_state"]: p + _h(rng.uniform(24, 4 * 24, n)),
        leak_names["investigation_result"]: p + _h(rng.uniform(7 * 24, 30 * 24, n)),
        leak_names["cb_resolution_flag"]: p + _h(rng.uniform(30 * 24, 60 * 24, n)),
    }
    for feature, when in availability.items():
        df[f"{feature}_available_time"] = _iso(when).values
    return df


V1_NAMES = {
    "fraud_confirmed": "fraud_confirmed",
    "payment_final_state": "payment_final_state",
    "investigation_result": "investigation_result",
    "cb_resolution_flag": "cb_resolution_flag",
}
# Next quarter, another team rebuilt the table and renamed the same post-outcome fields.
V2_NAMES = {
    "fraud_confirmed": "confirmed_fraud_flag",
    "payment_final_state": "payment_final_status",
    "investigation_result": "investigation_outcome",
    "cb_resolution_flag": "chargeback_resolution",
}


# ---------------------------------------------------------------------------- retail forecast (history)
def retail_forecast(rng: np.random.Generator) -> pd.DataFrame:
    """Daily stock-out prediction per store and product; future sales aggregates were joined in."""
    n = 3200
    pred = START - pd.Timedelta(days=150) + _h(np.sort(rng.uniform(0, 90 * 24, n)))
    demand = rng.gamma(4, 12, n)
    stock = np.round(demand * rng.uniform(0.6, 1.8, n))
    stockout = (stock < demand * rng.uniform(0.85, 1.05, n)).astype(int)
    tomorrow = np.round(demand * rng.uniform(0.85, 1.15, n))
    df = pd.DataFrame(
        {
            "forecast_id": [f"FC-{i:05d}" for i in range(n)],
            "store_id": [f"S{s}" for s in rng.integers(100, 160, n)],
            "decision_time": _iso(pred),
            "yesterday_sales": np.round(demand * rng.uniform(0.8, 1.2, n)),
            "last_7_days_sales": np.round(demand * 7 * rng.uniform(0.85, 1.15, n)),
            "current_stock": stock,
            "current_price": np.round(rng.uniform(2, 40, n), 2),
            "next_week_sales": np.round(tomorrow * 7 * rng.uniform(0.9, 1.1, n)),
            "month_end_total_sales": np.round(demand * 30 * rng.uniform(0.9, 1.1, n)),
            "stockout_next_day": stockout,
        }
    )
    p = pd.Series(pred)
    availability = {
        "yesterday_sales": p - _h(rng.uniform(2, 20, n)),
        "last_7_days_sales": p - _h(rng.uniform(2, 20, n)),
        "current_stock": p - _h(rng.uniform(0.1, 2, n)),
        "current_price": p - _h(rng.uniform(24, 24 * 14, n)),
        "next_week_sales": p + _h(rng.uniform(7 * 24, 8 * 24, n)),
        "month_end_total_sales": p + _h(rng.uniform(5 * 24, 30 * 24, n)),
    }
    for feature, when in availability.items():
        df[f"{feature}_available_time"] = _iso(when).values
    return df.rename(columns={"stockout_next_day": "target"})


# ---------------------------------------------------------------------------- earlier long-format samples
def _legacy_fraud_base(rng: np.random.Generator, n: int, id_prefix: str) -> pd.DataFrame:
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
    df["chargeback_filed"] = np.where(fraud == 1, rng.random(n) < 0.9, rng.random(n) < 0.02).astype(int)
    df["settlement_status"] = np.where(
        fraud == 1, rng.choice([0, 1, 2], n, p=[0.1, 0.2, 0.7]), rng.choice([0, 1, 2], n, p=[0.85, 0.12, 0.03])
    )
    return df


def _legacy_availability(rng: np.random.Generator, df: pd.DataFrame) -> dict[str, pd.Series]:
    n = len(df)
    p = df["prediction_time"]
    merchant_late = rng.random(n) < 0.12
    return {
        "transaction_amount": p,
        "customer_risk_score": p - _h(rng.uniform(0.05, 6, n)),
        "device_risk_score": p - _h(rng.uniform(0.01, 0.5, n)),
        "transaction_velocity": p - _h(rng.uniform(0.01, 1, n)),
        "merchant_risk_score": np.where(merchant_late, p + _h(rng.uniform(1, 9, n)), p - _h(rng.uniform(1, 20, n))),
        "chargeback_filed": p + _h(rng.uniform(3 * 24, 10 * 24, n)),
        "settlement_status": p + _h(rng.uniform(24, 3 * 24, n)),
    }


def _to_long(df: pd.DataFrame, avail: dict[str, pd.Series]) -> pd.DataFrame:
    frames = []
    for feature, when in avail.items():
        frames.append(
            pd.DataFrame(
                {
                    "decision_id": df["decision_id"],
                    "feature_name": feature,
                    "feature_value": df[feature],
                    "prediction_time": df["prediction_time"],
                    "available_time": pd.Series(when, index=df.index).dt.round("min"),
                    "target": df["target"],
                }
            )
        )
    out = pd.concat(frames).sort_values(["prediction_time", "decision_id", "feature_name"], kind="stable")
    for col in ("prediction_time", "available_time"):
        out[col] = out[col].dt.strftime(ISO)
    return out


def legacy_q1(rng) -> pd.DataFrame:
    df = _legacy_fraud_base(rng, 4000, "TXN")
    return _to_long(df, _legacy_availability(rng, df))


def legacy_q2_wide(rng) -> pd.DataFrame:
    df = _legacy_fraud_base(rng, 3000, "TX2")
    avail = _legacy_availability(rng, df)
    rename = {"chargeback_filed": "cb_resolution_flag", "settlement_status": "payment_final_state"}
    out = pd.DataFrame(
        {
            "transaction_id": df["decision_id"],
            "scored_at": df["prediction_time"].dt.strftime(ISO),
            "is_fraud": df["target"],
        }
    )
    for feature, when in avail.items():
        name = rename.get(feature, feature)
        out[name] = df[feature]
        out[f"{name}_available_time"] = pd.Series(when, index=df.index).dt.round("min").dt.strftime(ISO)
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
    p = df["prediction_time"]
    avail = {
        "income": p - _h(rng.uniform(24, 24 * 30, n)),
        "debt_to_income": p - _h(rng.uniform(1, 72, n)),
        "credit_utilization": p - _h(rng.uniform(1, 48, n)),
        "months_employed": p - _h(rng.uniform(24, 24 * 14, n)),
        "prior_delinquencies": p - _h(rng.uniform(2, 96, n)),
    }
    return _to_long(df, avail)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # The legacy samples keep their original seed so their contents are unchanged.
    legacy = np.random.default_rng(20260928)
    datasets = {
        "fraud_detection_q1.csv": legacy_q1(legacy),
        "fraud_detection_q2_wide.csv": legacy_q2_wide(legacy),
        "credit_default_clean.csv": credit_clean(legacy),
        "fraud_model_v1.csv": card_fraud(np.random.default_rng(101), 7200, START, V1_NAMES),
        "fraud_model_v2.csv": card_fraud(np.random.default_rng(202), 7400, START + pd.Timedelta(days=75), V2_NAMES),
        "retail_demand_forecast.csv": retail_forecast(np.random.default_rng(303)),
    }
    for name, frame in datasets.items():
        frame.to_csv(OUT / name, index=False)
        print(f"{name}: {len(frame):,} rows x {frame.shape[1]} columns")


if __name__ == "__main__":
    main()
