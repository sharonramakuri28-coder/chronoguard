"""Natural-language explanations grounded in measured evidence.

With Azure OpenAI configured, a chat model writes the explanation from a JSON
fact sheet (it is told to use only those numbers). Otherwise a deterministic
template renders the same facts. The provider is always reported to the UI.
"""

from __future__ import annotations

import json
import logging

import pandas as pd

from config import get_settings
from engine.leakage_detector import format_duration

log = logging.getLogger(__name__)

TEMPLATE = "template"
AZURE = "azure-openai"


def _date(iso: str | None) -> str:
    return pd.Timestamp(iso).strftime("%b %d, %Y") if iso else "?"


def lesson_text(dataset_name: str, f: dict) -> str:
    return (
        f"In {dataset_name}, '{f['feature']}' became available a median of "
        f"{format_duration(f['delay_median_hours'])} (up to {format_duration(f['delay_max_hours'])}) after the "
        f"prediction, in {f['leak_rate']:.0%} of decisions. Any feature carrying this signal is post-outcome data: "
        f"only values known as of prediction time may be used for training or backtests."
    )


def template_explanation(dataset_name: str, audit: dict, risk: dict) -> str:
    leaked = [f for f in audit["feature_results"] if f["status"] == "leaked"]
    period = f"{_date(audit['period_start'])} – {_date(audit['period_end'])}"
    parts = [f"ChronoGuard audited {audit['decisions']:,} decisions in {dataset_name} ({period})."]
    if not leaked:
        unverified = [f["feature"] for f in audit["feature_results"] if f["status"] == "unverified"]
        parts.append(f"All {audit['features']} features with timestamps were available at or before prediction time.")
        if unverified:
            parts.append(f"{len(unverified)} feature(s) have no availability timestamp and could not be verified.")
        parts.append(f"Risk score {risk['score']:.0f}/100 ({risk['band']}).")
        return " ".join(parts)

    parts.append(
        f"{len(leaked)} of {audit['features']} features {'was' if len(leaked) == 1 else 'were'} used before "
        f"{'it' if len(leaked) == 1 else 'they'} existed, affecting {audit['affected_decisions']:,} "
        f"decision{'' if audit['affected_decisions'] == 1 else 's'} ({audit['affected_decision_rate']:.0%})."
    )
    worst = max(leaked, key=lambda f: f["leak_rate"] * (f["delay_median_hours"] or 0))
    parts.append(
        f"The most severe is '{worst['feature']}': available a median of "
        f"{format_duration(worst['delay_median_hours'])} after the prediction in {worst['leak_rate']:.0%} of decisions."
    )
    recurring = [f for f in risk["features"] if f.get("memory") and f["label"].startswith("Recurring")]
    if recurring:
        m = recurring[0]["memory"]
        parts.append(
            f"This is a recurring pattern: '{recurring[0]['feature']}' matches the earlier incident "
            f"'{m['feature']}' from {m['dataset_name']} ({m['similarity']:.0%} similar)."
        )
    parts.append(
        f"Risk score {risk['score']:.0f}/100 ({risk['band']}). Remove these features or rebuild them from values "
        "known as of prediction time, then run the replay to measure the true model performance."
    )
    return " ".join(parts)


class Explainer:
    def __init__(self) -> None:
        s = get_settings()
        self.client = None
        self.deployment = s.azure_openai_chat_deployment
        if s.azure_openai_endpoint and s.azure_openai_api_key and self.deployment:
            try:
                from openai import AzureOpenAI

                self.client = AzureOpenAI(
                    azure_endpoint=s.azure_openai_endpoint,
                    api_key=s.azure_openai_api_key,
                    api_version=s.azure_openai_api_version,
                    timeout=30,
                )
            except Exception as exc:  # pragma: no cover
                log.warning("Azure OpenAI chat disabled: %s", exc)

    @property
    def provider(self) -> str:
        return AZURE if self.client else TEMPLATE

    def explain(self, dataset_name: str, audit: dict, risk: dict) -> tuple[str, str]:
        fallback = template_explanation(dataset_name, audit, risk)
        if not self.client:
            return fallback, TEMPLATE
        facts = {
            "dataset": dataset_name,
            "decisions": audit["decisions"],
            "period": [audit["period_start"], audit["period_end"]],
            "affected_decisions": audit["affected_decisions"],
            "risk_score": risk["score"],
            "risk_band": risk["band"],
            "features": [
                {k: f[k] for k in ("feature", "status", "leak_rate", "delay_median_hours", "delay_max_hours")}
                for f in audit["feature_results"]
            ],
            "memory_matches": [
                {
                    "feature": f["feature"],
                    "past_feature": f["memory"]["feature"],
                    "past_dataset": f["memory"]["dataset_name"],
                    "similarity": f["memory"]["similarity"],
                }
                for f in risk["features"]
                if f.get("memory")
            ],
        }
        try:
            resp = self.client.chat.completions.create(
                model=self.deployment,
                temperature=0.2,
                max_tokens=300,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are ChronoGuard, an ML audit assistant. Explain temporal data leakage findings to a "
                            "data science lead in 3-5 sentences. Use ONLY the numbers in the provided JSON; "
                            "never invent "
                            "metrics. Delays are in hours. End with one concrete recommendation."
                        ),
                    },
                    {"role": "user", "content": json.dumps(facts)},
                ],
            )
            text = (resp.choices[0].message.content or "").strip()
            return (text, AZURE) if text else (fallback, TEMPLATE)
        except Exception as exc:
            log.warning("Azure OpenAI explanation failed, using template: %s", exc)
            return fallback, TEMPLATE
