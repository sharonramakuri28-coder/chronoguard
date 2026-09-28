"""Model replay: measure how much leaked features inflate model performance.

Two identical models are trained on a time-ordered split (train on the
earliest 70% of decisions, test on the latest 30%):

* baseline   - every feature, as the original experiment did
* leak-free  - the features the detector found leaking are removed

A drop-one ablation then measures each leaked feature's own contribution.
All numbers are measured on the held-out test period.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

from engine.parsing import ParsedDataset

MIN_DECISIONS = 200
TRAIN_FRACTION = 0.7
SEED = 42


class ReplayUnavailable(ValueError):
    """The dataset cannot support a replay (no labels, too small, one class...)."""


@dataclass
class ModelMetrics:
    features: list[str]
    accuracy: float
    auc: float
    precision: float
    recall: float
    f1: float


@dataclass
class AblationResult:
    feature: str
    auc_without: float
    auc_drop: float  # baseline AUC - AUC without this feature


@dataclass
class ReplayResult:
    model: str
    train_size: int
    test_size: int
    train_period_end: str
    test_period_start: str
    positive_rate_test: float
    removed_features: list[str]
    baseline: ModelMetrics
    leak_free: ModelMetrics
    auc_delta: float
    accuracy_delta: float
    ablation: list[AblationResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _fit_eval(X_train, y_train, X_test, y_test, features: list[str]) -> ModelMetrics:
    if not features:
        # No usable features: the honest model predicts the training base rate.
        p = float(y_train.mean())
        proba = np.full(len(y_test), p)
    else:
        model = HistGradientBoostingClassifier(random_state=SEED, max_iter=200, categorical_features="from_dtype")
        model.fit(X_train[features], y_train)
        proba = model.predict_proba(X_test[features])[:, 1]
    pred = (proba >= 0.5).astype(int)
    return ModelMetrics(
        features=features,
        accuracy=round(float(accuracy_score(y_test, pred)), 4),
        auc=round(float(roc_auc_score(y_test, proba)), 4),
        precision=round(float(precision_score(y_test, pred, zero_division=0)), 4),
        recall=round(float(recall_score(y_test, pred, zero_division=0)), 4),
        f1=round(float(f1_score(y_test, pred, zero_division=0)), 4),
    )


def run_replay(ds: ParsedDataset, leaked_features: list[str]) -> ReplayResult:
    if not ds.has_target:
        raise ReplayUnavailable("Replay needs a target/label column to measure model performance.")

    decisions = ds.decisions.dropna(subset=["target"]).sort_values("prediction_time", kind="stable")
    values = set(decisions["target"].unique())
    if not values <= {0.0, 1.0}:
        raise ReplayUnavailable("Replay currently supports binary targets (0/1, true/false, yes/no).")
    if len(decisions) < MIN_DECISIONS:
        raise ReplayUnavailable(f"Replay needs at least {MIN_DECISIONS} labelled decisions (found {len(decisions)}).")

    X = ds.matrix.reindex(decisions["decision_id"])
    features = [c for c in X.columns if X[c].notna().any()]
    if not features:
        raise ReplayUnavailable("Replay needs feature values (a feature_value column or wide-format values).")
    X = X[features]
    y = decisions["target"].astype(int).to_numpy()

    cut = int(len(decisions) * TRAIN_FRACTION)
    y_train, y_test = y[:cut], y[cut:]
    if len(set(y_train)) < 2 or len(set(y_test)) < 2:
        raise ReplayUnavailable("Both classes must appear in the training and the test period.")
    X_train, X_test = X.iloc[:cut], X.iloc[cut:]

    removed = [f for f in leaked_features if f in features]
    clean = [f for f in features if f not in removed]
    baseline = _fit_eval(X_train, y_train, X_test, y_test, features)
    leak_free = _fit_eval(X_train, y_train, X_test, y_test, clean)

    ablation = []
    for f in removed:
        without = _fit_eval(X_train, y_train, X_test, y_test, [c for c in features if c != f])
        ablation.append(AblationResult(f, without.auc, round(baseline.auc - without.auc, 4)))
    ablation.sort(key=lambda a: -a.auc_drop)

    times = decisions["prediction_time"]
    return ReplayResult(
        model="HistGradientBoostingClassifier (scikit-learn)",
        train_size=cut,
        test_size=len(decisions) - cut,
        train_period_end=pd.Timestamp(times.iloc[cut - 1]).isoformat(),
        test_period_start=pd.Timestamp(times.iloc[cut]).isoformat(),
        positive_rate_test=round(float(y_test.mean()), 4),
        removed_features=removed,
        baseline=baseline,
        leak_free=leak_free,
        auc_delta=round(leak_free.auc - baseline.auc, 4),
        accuracy_delta=round(leak_free.accuracy - baseline.accuracy, 4),
        ablation=ablation,
    )
