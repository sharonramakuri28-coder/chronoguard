import csv
import random
from datetime import datetime, timedelta

OUTPUT_FILE = "../../data/chronoguard_financial_experiments.csv"

random.seed(42)

rows = []

experiments = [
    {
        "experiment_id": "EXP-001",
        "model_name": "FraudRisk-v12",
        "reported_accuracy": 0.978,
        "leakage_features": {
            "chargeback_result": 7,
            "settlement_status": 2
        }
    },
    {
        "experiment_id": "EXP-002",
        "model_name": "FraudRisk-v13",
        "reported_accuracy": 0.981,
        "leakage_features": {
            "cb_resolution": 6,
            "payment_final_state": 3
        }
    },
    {
        "experiment_id": "EXP-003",
        "model_name": "FraudRisk-v14",
        "reported_accuracy": 0.974,
        "leakage_features": {
            "claim_final_status": 5
        }
    }
]

safe_features = [
    "transaction_amount",
    "customer_risk_score",
    "merchant_risk_score",
    "device_risk_score",
    "transaction_velocity"
]

sources = {
    "transaction_amount": "payments",
    "customer_risk_score": "risk_engine",
    "merchant_risk_score": "merchant_risk",
    "device_risk_score": "device_intelligence",
    "transaction_velocity": "payments"
}

for experiment in experiments:

    start_date = datetime(2026, 1, 1)

    for transaction_id in range(1, 101):

        prediction_time = start_date + timedelta(
            hours=transaction_id * 3
        )

        # Safe features
        for feature in safe_features:

            available_time = prediction_time - timedelta(
                minutes=random.randint(1, 30)
            )

            rows.append({
                "experiment_id": experiment["experiment_id"],
                "model_name": experiment["model_name"],
                "transaction_id": f"{experiment['experiment_id']}-TX-{transaction_id:04d}",
                "feature_name": feature,
                "prediction_time": prediction_time.isoformat(),
                "available_time": available_time.isoformat(),
                "source": sources[feature],
                "reported_accuracy": experiment["reported_accuracy"],
                "expected_status": "SAFE"
            })

        # Leakage features
        for feature, delay_days in experiment["leakage_features"].items():

            available_time = prediction_time + timedelta(
                days=delay_days,
                hours=random.randint(0, 23)
            )

            rows.append({
                "experiment_id": experiment["experiment_id"],
                "model_name": experiment["model_name"],
                "transaction_id": f"{experiment['experiment_id']}-TX-{transaction_id:04d}",
                "feature_name": feature,
                "prediction_time": prediction_time.isoformat(),
                "available_time": available_time.isoformat(),
                "source": "payments",
                "reported_accuracy": experiment["reported_accuracy"],
                "expected_status": "LEAKAGE"
            })


with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as file:

    fieldnames = [
        "experiment_id",
        "model_name",
        "transaction_id",
        "feature_name",
        "prediction_time",
        "available_time",
        "source",
        "reported_accuracy",
        "expected_status"
    ]

    writer = csv.DictWriter(file, fieldnames=fieldnames)

    writer.writeheader()
    writer.writerows(rows)


print("Dataset created successfully!")
print(f"File: {OUTPUT_FILE}")
print(f"Rows: {len(rows)}")