"""Audit report: executive summary, risk, evidence, timeline, memory references, fixes.

Rendered as Markdown so it can be downloaded, pasted into a ticket or printed. Every value
comes from the stored audit, its latest replay and the incident memory.
"""

from __future__ import annotations

from datetime import UTC, datetime

from api.serializers import latest_replay
from engine.leakage_detector import format_duration
from memory import incidents as inc_mod
from models.tables import Audit


def _cell(v) -> str:
    return str(v).replace("|", "\\|").replace("\n", " ")


def _table(headers: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(_cell(c) for c in row) + " |" for row in rows]
    return "\n".join(out)


def _hours(h) -> str:
    return format_duration(h) if h is not None else "—"


def build_report(audit: Audit) -> tuple[str, str, datetime]:
    """Return (title, markdown, generated_at)."""
    r, risk, ds = audit.result, audit.risk, audit.dataset
    now = datetime.now(UTC)
    title = f"ChronoGuard audit report — {ds.name}"
    leaked = [f for f in r["feature_results"] if f["status"] == "leaked"]
    recall = audit.memory_recall or []
    recs = audit.recommendations or []
    rep = latest_replay(audit)
    replay = rep.result if rep and rep.status == "completed" else None

    md = [f"# {title}", ""]
    md.append(
        f"Audit #{audit.id} · model: {ds.model_name or 'not specified'} · "
        f"audited {audit.created_at:%Y-%m-%d %H:%M} UTC · report generated {now:%Y-%m-%d %H:%M} UTC"
    )
    if ds.is_sample:
        md.append("\n> Bundled sample dataset. Its rows are synthetic; every number below was computed from them.")

    md += ["", "## Executive summary", ""]
    if leaked:
        summary = (
            f"**{len(leaked)} of {r['features']} features used information from the future.** "
            f"{r['affected_decisions']:,} of {r['decisions']:,} decisions ({r['affected_decision_rate']:.0%}) "
            f"were scored with at least one value that did not exist yet."
        )
        if recall:
            summary += (
                f" ChronoGuard has seen this failure before: {len(recall)} feature(s) match incidents already in "
                "memory."
            )
        if replay:
            summary += (
                f" Removing the leaked features moved ROC-AUC from {replay['baseline']['auc']:.3f} to "
                f"{replay['leak_free']['auc']:.3f}: the previous score was inflated because future information "
                "was used."
            )
        if head := inc_mod.headline(recs):
            summary += f" **Recommended action:** {head}"
        md.append(summary)
    else:
        md.append(
            f"No temporal leakage found. All timestamped features were available at or before prediction time "
            f"across {r['decisions']:,} decisions."
        )

    md += ["", "## Risk score", ""]
    md.append(f"**{risk['score']:.0f} / 100 — {risk['band']}**  ")
    md.append(f"Formula: `{risk['formula']}`")
    md.append("")
    md.append(
        _table(
            ["Feature", "Score", "Band", "Assessment", "Timestamp evidence", "Memory"],
            [
                [
                    f["feature"],
                    f"{f['score']:.0f}",
                    f["band"],
                    f["label"],
                    f"{f['timestamp_score']:.0f}",
                    f"{f['memory_score']:.0f}",
                ]
                for f in risk["features"]
            ],
        )
    )

    md += ["", "## Evidence", ""]
    if leaked:
        md.append(
            _table(
                ["Feature", "Leaked decisions", "Leak rate", "Median delay", "Max delay", "Worst example"],
                [
                    [
                        f["feature"],
                        f"{f['leaked']:,} / {f['observations']:,}",
                        f"{f['leak_rate']:.1%}",
                        _hours(f["delay_median_hours"]),
                        _hours(f["delay_max_hours"]),
                        (
                            f"{f['worst_example']['decision_id']}: scored {f['worst_example']['prediction_time']}, "
                            f"available {f['worst_example']['available_time']}"
                        )
                        if f.get("worst_example")
                        else "—",
                    ]
                    for f in leaked
                ],
            )
        )
    else:
        md.append("No feature became available after its prediction time.")

    md += ["", "## Timeline", ""]
    if r.get("timeline_decision_id"):
        md.append(f"Decision `{r['timeline_decision_id']}`, scored at {r['timeline_prediction_time']}:")
        md.append("")
        for ev in sorted(r["timeline"], key=lambda e: (e["offset_hours"] is None, e["offset_hours"] or 0)):
            if ev["offset_hours"] is None:
                md.append(f"- `{ev['feature']}` — no availability timestamp")
                continue
            when = "after" if ev["offset_hours"] > 0 else "before"
            flag = " **← leaked**" if ev["leaked"] else ""
            md.append(f"- `{ev['feature']}` available {_hours(ev['offset_hours'])} {when} the prediction{flag}")
    else:
        md.append("No decision with timestamped features to show.")

    md += ["", "## Model replay", ""]
    if replay:
        b, c = replay["baseline"], replay["leak_free"]
        md.append(
            f"{replay['model']}, trained on the earliest {replay['train_size']:,} decisions and tested on the "
            f"latest {replay['test_size']:,} (time-ordered split)."
        )
        md.append("")
        md.append(
            _table(
                ["Metric", "With leaked features", "Leak-free", "Change"],
                [
                    [m, f"{b[k]:.3f}", f"{c[k]:.3f}", f"{c[k] - b[k]:+.3f}"]
                    for m, k in [
                        ("ROC-AUC", "auc"),
                        ("Accuracy", "accuracy"),
                        ("Precision", "precision"),
                        ("Recall", "recall"),
                        ("F1", "f1"),
                    ]
                ],
            )
        )
        if replay["removed_features"]:
            md.append("")
            md.append("The previous score was inflated because future information was used.")
    elif rep:
        md.append(f"Replay unavailable: {rep.message}")
    else:
        md.append("Replay has not been run for this audit.")

    md += ["", "## Memory references", ""]
    if recall:
        md.append(
            _table(
                ["This dataset", "Remembered incident", "Similarity", "Learned from", "Past fix", "Fix feedback"],
                [
                    [
                        m["matched_feature"],
                        f"#{m['incident_id']} {m['past_feature']}",
                        f"{m['similarity']:.0%}",
                        m["past_dataset"],
                        m["solution"] or m["lesson"],
                        f"{m['fix_confirmations']} confirmed / {m['fix_rejections']} rejected",
                    ]
                    for m in recall
                ],
            )
        )
    else:
        md.append("No similar incident in memory; this audit's findings are now stored for next time.")
    if audit.hindsight_context:
        md += ["", "Hindsight recalled:", ""] + [f"> {t}" for t in audit.hindsight_context]

    md += ["", "## Recommended fixes", ""]
    if recs:
        for i, rec in enumerate(recs, start=1):
            md.append(f"{i}. **{rec['feature']}** ({rec['priority']}): {rec['action']}")
            md.append(f"   - Why: {rec['reason']}")
            if rec.get("memory"):
                md.append(f"   - Memory: {rec['memory']}")
    else:
        md.append("Nothing to fix.")

    if fb := audit.feedback:
        md += ["", "## Team feedback", ""]
        md.append(
            f"The recommended fix was {'confirmed to work' if fb['successful'] else 'reported as not working'} "
            f"({fb['at'][:16].replace('T', ' ')} UTC)." + (f" Note: {fb['note']}" if fb.get("note") else "")
        )

    md += [
        "",
        "---",
        "",
        f"Generated by ChronoGuard from audit #{audit.id}. Explanation provider: "
        f"{audit.explanation_provider}; memory vectors: {audit.memory_provider}.",
    ]
    return title, "\n".join(md) + "\n", now
