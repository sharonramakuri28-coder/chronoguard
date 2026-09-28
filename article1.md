# I built an AI auditor that remembers when ML models make mistakes

The most dangerous model I have ever reviewed had an ROC-AUC of 0.985.

It was a fraud classifier, and every offline metric said it was ready for production. It was not. Two of its
features, `chargeback_filed` and `settlement_status`, were recorded days *after* each transaction was scored.
The model had learned to predict fraud by reading the outcome. When I retrained it on the same data without
those two columns (and a third that turned out to be partly late as well), the AUC fell to 0.676.

Nobody had done anything obviously wrong. A training table was built by joining several sources on
`transaction_id`, and the join did not care *when* each value became known. That is the whole problem, and it
is why I built ChronoGuard: an auditor that checks what a model could actually have known, measures what the
leak cost, and remembers the incident so the next dataset does not repeat it.

## Why a model can look accurate while using the future

Every prediction has a moment: the instant the model is asked to decide. Anything that became known after
that moment was not available in production, but it is often sitting right there in the training table.

Temporal leakage rarely looks like a bug. It looks like good features:

- a chargeback flag that arrives 3–10 days after the transaction;
- a settlement status that is final 1–3 days later;
- a risk score from a nightly batch job that sometimes finishes after the request was scored;
- a macroeconomic series whose "final revision" replaced the preliminary number the forecaster actually saw.

Standard validation cannot catch this. A random split puts the leaked column into both halves, so the test set
rewards the leak as generously as the training set. Feature importance calls it "the most predictive signal",
and everyone is happy until production, where that column does not exist yet.

The part that bothered me most was not the first leak. It was the second. The next quarter, a different team
rebuilt the model. The chargeback signal came back as `cb_resolution_flag`, and the settlement status came back
as `payment_final_state`. Same mistake, new names, no institutional memory.

## Detecting the future with timestamps, not opinions

I made one early decision that shaped everything else: **ChronoGuard never trusts a label that says whether a
feature leaks.** Many datasets I looked at carried columns like `expected_status` or
`available_at_decision_time = YES/NO`. Those are someone's opinion. ChronoGuard only accepts two timestamps per
value: when the prediction was made, and when that value became available.

The parser accepts a *long* layout (one row per decision and feature) or a *wide* layout (one row per decision,
with a `<feature>_available_time` column next to each feature). Verdict-like columns are reported as ignored.
After normalisation, detection is a vectorised comparison in `backend/engine/leakage_detector.py`:

```python
def detect_leakage(ds: ParsedDataset) -> AuditResult:
    obs = ds.observations.copy()
    obs["delay_hours"] = (obs["available_time"] - obs["prediction_time"]).dt.total_seconds() / 3600.0
    obs["has_ts"] = obs["available_time"].notna()
    obs["leaked"] = obs["has_ts"] & (obs["delay_hours"] > 0)
```

That single rule, `available_time > prediction_time`, drives the rest of the audit:
- **Per feature:** the leak rate, the median, 90th-percentile and maximum delay, and the worst example.
- **For the dataset:** the number of distinct *decisions* affected (not rows, a distinction I got wrong in an
  earlier prototype), plus a timeline for one real decision that shows each feature's availability relative
  to the moment of prediction.
- **Missing timestamps:** a feature without an availability timestamp is not called safe. It is marked
  *unverified*.

A test feeds it a CSV whose `expected_status` column contradicts the timestamps. The timestamps win.

Detection answers "did the model see the future?" To answer "how much did it matter?", ChronoGuard replays the
model:
- It sorts decisions by prediction time, trains on the earliest 70% and tests on the latest 30%.
- Two identical gradient-boosting models are trained: one with every feature, one without the leaked ones.
- A drop-one ablation then measures each leaked feature's own contribution.

The 0.985 → 0.676 at the top of this article comes from that replay. It is measured, not estimated.

## Remembering the mistake

Detection alone solves today's dataset. I wanted ChronoGuard to get better at spotting the *next* one, and that
needs memory.

I designed the memory in two layers, with a strict rule about what each one is allowed to influence.

**Layer 1: an incident store that affects scoring.**
- Every leaked feature becomes an incident in the SQL database, holding its delay statistics, a lesson written
  from the measured evidence, and a vector embedding of the feature name.
- By default the vector is computed locally: hashed word and character n-grams after expanding common
  abbreviations (`cb` → chargeback, `txn` → transaction) and dropping generic suffixes like `score` and
  `flag`. Azure OpenAI embeddings replace it when configured.
- When a new dataset arrives, each column is compared against incidents from *other* datasets:

```python
def match_features(self, features: list[str], exclude_dataset: str) -> tuple[str, dict[str, MemoryEvidence]]:
    """Best past incident per feature, if above the provider's similarity threshold."""
    provider, results = self.search(features, exclude_dataset)
    threshold = THRESHOLDS[provider]
    matches: dict[str, MemoryEvidence] = {}
    for feature, hits in zip(features, results, strict=True):
        if hits and hits[0].similarity >= threshold:
            inc = hits[0].incident
            matches[feature] = MemoryEvidence(inc.id, inc.feature, inc.dataset_name, hits[0].similarity, inc.lesson)
    return provider, matches
```

**Layer 2: long-term organizational memory with [Hindsight](https://hindsight.vectorize.io/).**
- A vector index remembers *names*. What a team actually learns is richer: why a signal leaked, which pipeline
  produced it, what rule came out of it.
- That is the gap [agent memory](https://vectorize.io/what-is-agent-memory) is meant to fill, so ChronoGuard
  ships an optional adapter for Hindsight ([GitHub](https://github.com/vectorize-io/hindsight)).
- When it is configured, every incident's lesson is retained in a Hindsight memory bank the first time it is
  seen.
- On every later audit that finds a leak, ChronoGuard asks Hindsight for previous incidents involving similar
  features and shows the recalled lessons in the audit report next to the measured evidence.

The two layers split the work deliberately. The incident store is local and deterministic, so it is allowed to
move a number. Hindsight is where lessons accumulate across projects and teams, so it is allowed to shape what
a person reads. ChronoGuard runs fully offline without Hindsight; with it, the auditor's memory outlives any
single database.

The lesson text itself is generated from facts, never invented:

```python
def lesson_text(dataset_name: str, f: dict) -> str:
    return (
        f"In {dataset_name}, '{f['feature']}' became available a median of "
        f"{format_duration(f['delay_median_hours'])} (up to {format_duration(f['delay_max_hours'])}) after the "
        f"prediction, in {f['leak_rate']:.0%} of decisions. Any feature carrying this signal is post-outcome data: "
        f"only values known as of prediction time may be used for training or backtests."
    )
```

## How a past lesson changes the next audit

Memory is only useful if it changes a decision, so the incident store feeds straight into risk scoring. A
feature's score starts from timestamp evidence (`100 × √(leak rate) × severity(median delay)`), and a
sufficiently similar past incident adds to it:

```python
def score_feature(f: FeatureLeakage, memory: MemoryEvidence | None) -> FeatureRisk:
    ts = timestamp_score(f)
    match = memory if memory and memory.similarity >= MIN_SIMILARITY else None
    mem = 0.0
    if match:
        mem = (MEMORY_ONLY_CAP if f.status == "unverified" else MEMORY_BOOST) * match.similarity
        if f.status == "safe":
            mem = 0.0  # timestamps prove it is safe here; memory is shown as context only
    score = round(min(100.0, ts + mem), 1)
```

The branches are the important part:
- **Memory confirms timestamp evidence:** a leak that matches an earlier incident scores higher and is
  labelled *Recurring leakage*.
- **Memory stands in for missing evidence:** a column with no availability timestamp but a strong match to a
  past incident is raised to "needs review" (up to 45).
- **Memory never overrules the clock:** if the timestamps prove a feature was available in time, memory is
  shown as context and adds nothing.

I learned that last rule the hard way. An early version happily raised the risk of `customer_risk_score`
because it "looked like" `merchant_risk_score`. Similar names are a reason to look, not proof.

## Before and after

This is the renamed-columns dataset from the second quarter, audited twice. The data is synthetic and seeded,
so the numbers are reproducible. Only the memory state differs between the two runs.

| Feature | Audit with empty memory | Audit after the Q1 incident was remembered |
|---|---|---|
| `cb_resolution_flag` | 88 · *New leakage* | **97 · Recurring leakage**: 57% similar to `chargeback_filed` from Q1 |
| `payment_final_state` | 80 · *New leakage* | 80 · *New leakage* (no match with local vectors) |
| `merchant_risk_score` | 23 · low | **38 · medium**: the same batch-job leak seen in Q1 |
| **Dataset risk** | **81 / 100** | **89 / 100** |

In the second run, the explanation says this is the chargeback problem again, cites the incident, and repeats
the rule the team already learned. The replay confirms the stakes: 0.994 AUC with every feature, 0.644 without
the leaked ones.

The table also shows the honest limit of offline memory. `payment_final_state` and `settlement_status` share no
words, so local vectors cannot connect them. Semantic embeddings can, and so can a richer lesson in Hindsight
that records *why* the settlement signal leaked. Either way, timestamps still flag the leak; only the "we have
seen this before" context is missing.

## What I took away

Three things stayed with me after building this.

First, **the check itself is trivially simple**: comparing two timestamps. The hard parts were everywhere
around it:
- refusing to trust labels;
- counting decisions instead of rows;
- treating missing timestamps as unknown rather than safe;
- measuring the impact instead of asserting it.

Second, **an auditor without memory repeats itself.** Most ML failures I have seen were not new; they were old
mistakes under new column names. Storing incidents, and letting them change the next score, turned
ChronoGuard from a checker into something closer to a colleague who was there last time.

Third, **memory should inform, and evidence should decide.** Timestamps decide whether a feature leaked.
Memory decides how urgently a person should look. Keeping that line sharp made the system easier to trust.

Your model should only know what the world knew at the time. Your auditor should remember everything it has
learned since.
