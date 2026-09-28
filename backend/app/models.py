from datetime import datetime
from pydantic import BaseModel, Field


class FeatureObservation(BaseModel):
    feature_name: str
    prediction_time: datetime
    available_time: datetime
    source: str = "synthetic"
    description: str = ""


class Experiment(BaseModel):
    experiment_id: str
    model_name: str
    reported_metric: float
    metric_name: str = "accuracy"
    target_name: str = "fraud"
    features: list[FeatureObservation] = Field(default_factory=list)


class LeakageFinding(BaseModel):
    feature_name: str
    prediction_time: datetime
    available_time: datetime
    delay_hours: float
    severity: str
    explanation: str


class AuditResult(BaseModel):
    experiment_id: str
    model_name: str
    reported_metric: float
    corrected_metric: float
    metric_name: str
    leakage_count: int
    findings: list[LeakageFinding]
    summary: str
    memory_action: str
