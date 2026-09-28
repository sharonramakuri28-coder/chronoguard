from datetime import datetime
from .models import Experiment, FeatureObservation


def get_demo_experiment() -> Experiment:
    return Experiment(
        experiment_id="EXP-001",
        model_name="FraudRisk-v12",
        reported_metric=0.978,
        metric_name="accuracy",
        target_name="fraud",
        features=[
            FeatureObservation(
                feature_name="transaction_amount",
                prediction_time=datetime.fromisoformat("2026-01-10T10:00:00"),
                available_time=datetime.fromisoformat("2026-01-10T10:00:00"),
                description="Known at transaction time",
            ),
            FeatureObservation(
                feature_name="customer_risk_score",
                prediction_time=datetime.fromisoformat("2026-01-10T10:00:00"),
                available_time=datetime.fromisoformat("2026-01-10T09:55:00"),
                description="Computed before prediction",
            ),
            FeatureObservation(
                feature_name="chargeback_result",
                prediction_time=datetime.fromisoformat("2026-01-10T10:00:00"),
                available_time=datetime.fromisoformat("2026-01-17T15:00:00"),
                source="payments",
                description="Final outcome available days later",
            ),
            FeatureObservation(
                feature_name="settlement_status",
                prediction_time=datetime.fromisoformat("2026-01-10T10:00:00"),
                available_time=datetime.fromisoformat("2026-01-12T16:00:00"),
                source="payments",
                description="Settlement finalizes after prediction",
            ),
        ],
    )
