# I gave my ML auditor Hindsight memory of past leaks

The failure that convinced me temporal leakage is a memory problem isn't the first leak. It's the rename. A fraud team finds that `cb_resolution_flag` was joined into its training table from a system that only fills it in weeks after the transaction. They remove it and write it up. Later, another team rebuilds the feature table, calls the same field `chargeback_resolution`, and ships the same mistake with a straight face.

Finding the leak wasn't the hard part. Remembering it was. This is the story of how I built ChronoGuard, an auditor that checks ML training data for information from the future, and why the most important code in it turned out to be the part that decides what to remember.

## What ChronoGuard does

Temporal leakage is simple to state. A model making a decision at time T may only use values that existed at time T. Training tables are built later, by joins, and they happily pull in values that arrived after the decision: a fraud confirmation recorded two weeks after the transaction, a payment state finalised days later, an investigation outcome closed a month later. The model learns from the outcome, offline metrics look superb, and production quietly disagrees.

ChronoGuard takes a CSV where every feature value carries an availability timestamp and every decision carries a prediction timestamp. The core check is almost embarrassingly small: a value leaks if `available_time > prediction_time`. Everything around that check is where the work is:

- **Parse** long or wide layouts, and ignore identifiers and raw event timestamps.
- **Detect** leaks per feature, with leak rate and delay distribution.
- **Score** risk from 0 to 100 with a formula that is shown in the UI, not hidden.
- **Replay** the model on a time-ordered split, with and without the leaked features, to measure how much of the reported performance was fake.
- **Remember** every leaked feature as a structured incident, recall similar incidents on the next audit, and learn from whether the recommended fix worked.

The stack is deliberately boring: FastAPI, SQLAlchemy, pandas and scikit-learn on the backend, and React with TypeScript on the front. Detection, scoring and replay are deterministic Python. The same file gives the same answer every time, which matters when you're telling a team their model is lying.

The memory layer has two tiers. A SQL incident store with vector search is the source of truth: it drives scoring and never goes down. On top of it, every incident is retained in [Hindsight](https://github.com/vectorize-io/hindsight), which is where the organisational memory lives.

## The core decision: memory is a record, not a log line

My first version of "memory" was a table of leaked feature names with embeddings. A new dataset's columns were compared by cosine similarity, and a match bumped the risk score. It worked, and it was nearly useless to a human. "Similar to `chargeback_filed` (57%)" tells you *that* something happened before, not *what* happened, what was done about it, or whether that worked.

So I changed what an incident is. It's no longer a feature name. It's the whole post-mortem, generated from measured facts:

- the incident type, dataset and model;
- the cause, expressed as leak rate and delay;
- a concrete decision ID with both timestamps;
- the replay's measured impact on ROC-AUC and accuracy;
- the fix, and whether it repeats an earlier incident;
- how many times the team confirmed or rejected that fix.

Then came the part I went back and forth on: what to hand to Hindsight. My instinct was JSON. I ended up sending prose. [Hindsight's retain pipeline](https://hindsight.vectorize.io/) extracts facts and entities from text, so a sentence like "decision TX-2601-007160 was scored at 13:13 but the value only became available 20 days later" gives it far more to work with than `{"delay_hours": 479.98}`. The structured bits go into metadata and tags instead.

```python
def hindsight_content(inc) -> str:
    """Natural-language record for Hindsight, which extracts facts and entities from text."""
    lines = [
        f"ChronoGuard incident: {inc.incident_type or INCIDENT_TYPE} in {inc.model_name or 'an ML model'} "
        f"(dataset {inc.dataset_name}).",
        f"Problematic feature: {inc.feature}.",
        f"Cause: {inc.cause or inc.lesson}",
    ]
    ev = inc.evidence or {}
    if ev.get("example_decision_id"):
        lines.append(
            f"Timeline evidence: decision {ev['example_decision_id']} was scored at {ev['example_prediction_time']} "
            f"but the value only became available at {ev['example_available_time']}."
        )
    if inc.impact:
        lines.append(f"Impact: {inc.impact}")
    if inc.solution:
        lines.append(f"Fix: {inc.solution}")
    if inc.recurrence_of:
        lines.append("This repeats an earlier ChronoGuard incident with a similar feature.")
    if fb := feedback_summary(inc):
        lines.append(fb)
    lines.append(f"Lesson: {inc.lesson}")
    return "\n".join(lines)
```

Every string in that record is derived from the audit, the replay or team feedback. Nothing is written by a language model, so nothing in memory can be a hallucination that later gets recalled as fact. That constraint shaped a lot of later decisions.

## Memory that changes has to be addressable

The record isn't static. The replay runs after the audit and fills in the impact. The team answers "Was this fix successful?" days later. A later dataset recalls the incident and adds a recurrence. If every one of those events appended a new memory, the bank would fill with five slightly different versions of the same incident, and recall would happily return the stale one.

The fix was to give each incident a stable identity and retain it in replace mode:

```python
def sync_hindsight(self, inc: Incident) -> bool:
    """Retain (or replace) the incident's full record in Hindsight. False when unavailable."""
    inc.hindsight_document_id = inc.hindsight_document_id or incidents.document_id(inc.dataset_name, inc.feature)
    ok = self.hindsight.retain(
        incidents.hindsight_content(inc),
        context=f"ChronoGuard {inc.incident_type or incidents.INCIDENT_TYPE} incident",
        document_id=inc.hindsight_document_id,
        metadata=incidents.hindsight_metadata(inc),
        tags=incidents.hindsight_tags(inc),
    )
    inc.hindsight_retained = ok or bool(inc.hindsight_retained)
    return ok
```

The document ID is `chronoguard-incident-<dataset>-<feature>`, and the adapter passes `update_mode="replace"` whenever a document ID is present. The metadata carries dataset, model, feature, leak rate and fix counts as strings. The tags carry `temporal-leakage`, `feature:…` and `model:…`. Every time the SQL row changes, the whole record is re-rendered and replaced. SQL is the source of truth, and Hindsight always holds the latest rendering of it. That one rule removed an entire class of "which version is right?" bugs.

## Closing the loop: feedback is the memory's training signal

Recall on its own is a search engine. What made ChronoGuard feel like it was learning was a one-question prompt after each audit: **was this fix successful?** The answer is written onto this dataset's incidents *and* onto every remembered incident the audit recalled. The second part is the one that matters. If model v2 recalled model v1's `fraud_confirmed` incident and the team says removing the field worked, v1's incident now carries that confirmation into every future recall.

```python
affected = list(db.scalars(select(Incident).where(Incident.dataset_name == audit.dataset.name)))
recalled_ids = {r["incident_id"] for r in (audit.memory_recall or [])}
affected += [i for i in db.scalars(select(Incident).where(Incident.id.in_(recalled_ids))) if i not in affected]

previous = audit.feedback
for inc in affected:
    if previous is not None:
        if previous.get("successful"):
            inc.fix_confirmations = max(0, (inc.fix_confirmations or 0) - 1)
        else:
            inc.fix_rejections = max(0, (inc.fix_rejections or 0) - 1)
    if successful:
        inc.fix_confirmations = (inc.fix_confirmations or 0) + 1
    else:
        inc.fix_rejections = (inc.fix_rejections or 0) + 1
```

Every affected incident is then re-retained. The recommendation builder reads the counts back: "Same failure as 'fraud_confirmed' in fraud_model_v1.csv (100% similar). That fix was confirmed to work 1 time(s)." A rejected fix produces a different note: check the upstream pipeline too. Confidence is Laplace-smoothed, `(yes + 1) / (yes + no + 2)`, and shown as "—" until anyone has answered. I didn't want a dashboard claiming 100% confidence from one click.

This is what people mean by [agent memory](https://vectorize.io/what-is-agent-memory) when they mean something more than a vector store. The agent's behaviour on the next input depends on what happened after its last output.

## The painful part: a sync client inside an async server

The Hindsight Python client exposes synchronous `retain`, `recall` and `reflect`, which wrap async calls internally. FastAPI's upload handler is `async`, because it streams the file. Call a sync wrapper from inside a running event loop and you get `This event loop is already running`. My first integration swallowed that error, because every Hindsight call fails closed by design, so audits completed and the SQL store worked. Nothing was actually reaching Hindsight.

It took an embarrassingly long time to notice, because fail-closed is exactly as quiet as it's supposed to be. The fix was small once I saw it: run the whole audit off the event loop.

```python
# Off the event loop: the audit is CPU-bound and the Hindsight client's sync calls need a plain thread.
audit = await run_in_threadpool(audit_file, db, path, name, False, (model_name or "").strip() or None)
```

Startup seeding got the same treatment with `asyncio.to_thread`. The lesson I took was about the tests, not the fix. The fake Hindsight client in my test suite now refuses to run inside an event loop, exactly like the real one, so that regression can't come back silently. I also added a health state that distinguishes `configured` from `connected` from `connection_failed`, using a cached background probe, and a 60-second backoff after a failure so a dead endpoint costs one timeout instead of one per incident.

## What it looks like in practice

The end-to-end case I use to exercise the whole loop is two iterations of a card-fraud model.

**Model v1:** 7,200 transactions, 32 columns. ChronoGuard's recorded reasoning reads like a checklist:

1. Read 7,200 rows, 13 features, and ignored three non-feature columns.
2. Compared 93,600 feature values with their prediction times.
3. Searched memory and found nothing similar.
4. Flagged `fraud_confirmed`, `payment_final_state`, `investigation_result` and `cb_resolution_flag`, all post-outcome, plus `merchant_risk_score`, which was late in 12% of rows.

Risk came out at 94/100. The replay trained the same gradient-boosted model twice on the earliest 70% of decisions. ROC-AUC went from 1.000 with everything to 0.826 without the leaked fields, and accuracy from 99.9% to 90.3%. The page says it plainly: *the previous score was inflated because future information was used.* The team confirmed the fix.

**Model v2** arrives with every leaky column renamed: `confirmed_fraud_flag`, `payment_final_status`, `investigation_outcome`, `chargeback_resolution`. Before scoring anything, the agent searches memory and returns all five v1 incidents, at 64% to 100% similarity, each carrying the confirmed fix. The recommendation is one sentence: *Remove confirmed_fraud_flag, investigation_outcome, chargeback_resolution and payment_final_status before training.* The generated report's executive summary opens with "ChronoGuard has seen this failure before."

The assistant is where Hindsight's `reflect` earns its keep. Asked "Have we seen this failure before?", it answers first from the audit's own recall, with citations to incident IDs, then appends a Hindsight reflection over everything in the bank. The answer is labelled as such. Local vector search tells you which past column looks like this one. Reflection can connect a model, a data source and a fix across incidents that no single similarity score would link.

## Lessons I'd reuse

**1. Design the memory record before the recall.** Most of the value came from deciding what an incident *is*: cause, evidence, fix, impact, feedback. Retrieval quality is capped by what you chose to store.

**2. Give mutable memories an identity.** If a memory will be updated by later events, retain it under a stable document ID with replace semantics, and treat the memory layer as a projection of your source of truth rather than a second source of truth.

**3. Write memories as prose for extraction, and metadata for filtering.** Let the memory system do entity extraction on sentences. Keep machine-readable fields in metadata and tags, where they're exact.

**4. Feedback should flow backwards through recall.** Updating only the current dataset's incidents would have taught the system nothing. The confirmation has to land on the past incidents that produced the recommendation.

**5. Fail closed, but make it observable.** An optional dependency that fails silently is indistinguishable from one that isn't wired up. Test fakes should reproduce the real client's constraints, and health checks should say *why* something is off.

I set out to build a leakage detector. What I ended up building is closer to an institutional memory that happens to run a timestamp check first. The check catches the leak once. The memory is what stops the next team from shipping it again.
