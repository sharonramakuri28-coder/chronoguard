# I Gave My AI Auditor Memory of Past Failures

Most evaluation tools I have used share a quiet property: they have no past. They find something, you fix
it, and the next run starts from zero. The tool that caught a leaky feature on Monday catches the same mistake
on Friday with the same surprise, because nothing it learned survived the process exit.

For a linter that is fine; its rules are the memory. The failures I care about in ML pipelines don't come
with fixed rules. They come back renamed, rebuilt by a different person, joined from a different table.

So I gave mine a memory. Here is how it works, where it helps, and where I stopped it having authority.

## The problem

ChronoGuard audits datasets for temporal leakage: feature values that became available only *after* the
prediction they were used for. A chargeback flag recorded days after a card transaction was scored is the
classic case. Include it in training and the model looks excellent offline, because it is reading the
outcome it is supposed to predict.

Finding that once is not the hard part. Stopping it from happening again is. In the synthetic evaluation
datasets bundled with the repository, the first quarter's fraud table contains `chargeback_filed` and
`settlement_status`, both recorded after the prediction. The second quarter's table, rebuilt for the next
model iteration, contains `cb_resolution_flag` and `payment_final_state`. Same signals, same leak, new names.

This pattern is realistic for a boring reason. The knowledge that "chargeback data arrives after scoring"
lives in the head of whoever debugged the first incident, or in a ticket nobody will search. A one-time audit
catches the first occurrence; nothing about it makes the second one less likely.

That is the difference I kept coming back to: **detecting a failure is a property of one run; preventing a
repeated failure is a property of the system over time.** The second one requires state.

## Building memory into ChronoGuard

The audit pipeline has four stages that matter here:
1. **Detection** compares timestamps.
2. **Incident storage** records every leaked feature.
3. **Similarity search** compares a new dataset's columns against earlier incidents.
4. **Hindsight** holds the lessons in long-term memory.

Before any of it, I had to decide what memory is *for*. I settled on a strict division of responsibility:

- **Timestamps decide:** did this feature leak? A value leaks when `available_time > prediction_time`.
  Nothing else can change that answer.
- **Memory helps answer:** have we seen this kind of failure before, and what did we learn?

Memory must never override timestamp evidence. That rule shaped every design decision below.

### Layer 1: local, deterministic incident matching

Every leaked feature becomes an `Incident` row in the SQL database. Each incident stores:
- the dataset it came from;
- its leak rate and median and maximum delay;
- the number of affected decisions;
- a lesson generated from those numbers;
- a vector for its name.

The default vectors are computed locally: hashed word and character n-grams over a normalised version of
the feature name. Common abbreviations are expanded (`cb` → chargeback, `txn` → transaction), and generic
suffixes like `score` and `flag` are dropped before hashing.

This layer is intentionally modest. It runs offline and gives the same answer for the same input every
time, which matters: if memory is allowed to move a risk score, the movement has to be reproducible. When Azure OpenAI embeddings are configured, they replace
the local vectors. The match thresholds differ by provider (0.50 local, 0.60 Azure) because the two
similarity scales are not comparable.

### Layer 2: Hindsight for lessons, not lookups

A vector over column names is a weak form of memory. It knows that `cb_resolution_flag` looks like
`chargeback_filed`. It does not know *why* chargeback data leaks, which pipeline produced it, or what rule the
team adopted afterwards. That is closer to what [agent memory](https://vectorize.io/what-is-agent-memory) is
about: retaining experiences and recalling the relevant ones later, rather than replaying a transcript.

ChronoGuard has an optional adapter for [Hindsight](https://github.com/vectorize-io/hindsight), which does
exactly this: memory banks you `retain` into and `recall` from. The
[Hindsight documentation](https://hindsight.vectorize.io/) covers the model in detail. In ChronoGuard, the
adapter has two jobs:

1. **Retain.** When an incident is first recorded, its lesson is retained into a Hindsight memory bank, once.
2. **Recall.** When a later audit finds leaked features, ChronoGuard asks Hindsight for previous incidents
   involving similar features and attaches the recalled text to the audit report. The memory search page
   does the same for any column name a person types in.

Recalled Hindsight memories are shown to people; they do not change scores. Hindsight is where knowledge
accumulates across datasets and teams. The incident store is what the scoring code is allowed to trust.

## A worked example: `chargeback_filed` → `cb_resolution_flag`

Here is what happens when the second-quarter dataset is audited after the first one:

1. **Detection runs first**, and it needs no memory at all. `cb_resolution_flag` became available after the
   prediction in 100% of decisions, with a median delay of about 6.5 days. That is enough to flag it as
   leaked with a high timestamp score.
2. **Similarity search comes next.** The column normalises to "chargeback resolution", which scores 0.57
   cosine similarity against the stored `chargeback_filed` incident. That clears the 0.50 local threshold.
3. **Memory adds context and a bounded boost.** The feature's label changes from *New leakage* to *Recurring
   leakage*, the Q1 lesson is shown next to the timestamp evidence, and the score rises by
   15 × 0.57 ≈ 8.5 points.
4. **Hindsight, if configured,** returns whatever related lessons are in the bank, and they appear in the
   report as recalled context.

Now the limits, because they are real. `payment_final_state` is the renamed `settlement_status`, but the two
names share no words; local similarity is about 0.25, well under the threshold. Memory says nothing, and the
feature is labelled *New leakage*. It is still flagged, because the timestamps prove it leaked. Memory missed
a connection and nothing bad happened, because memory was never the thing deciding. Semantic embeddings might
link those names; I would not promise that any similarity method links every rename.

## Technical implementation

Order matters. Memory is searched *before* the current dataset's incidents are recorded, and a dataset is
excluded from matching its own incidents. Otherwise, re-auditing a file would "remember" itself and call every
leak recurring. From `backend/api/pipeline.py`:

```python
result = detect_leakage(ds)
store = MemoryStore(db)
provider, matches = store.match_features(ds.features, exclude_dataset=name)
risk = score_dataset(result, matches)
```

Recording is idempotent per dataset and feature. Re-auditing updates an incident instead of duplicating it,
and a flag makes sure each lesson is retained in Hindsight only once. From `backend/memory/store.py`:

```python
inc = existing.get(f["feature"]) or Incident(dataset_name=dataset_name, feature=f["feature"])
...
inc.lesson = lesson_text(dataset_name, f)
...
if not inc.hindsight_retained:
    inc.hindsight_retained = self.hindsight.retain(inc.lesson)
```

The Hindsight adapter is built to fail closed. If it isn't configured, or a call fails, the audit continues
with local memory and the report simply has no recalled context. From `backend/memory/hindsight_adapter.py`:

```python
def recall(self, query: str, limit: int = 3) -> list[str]:
    if not self.client:
        return []
    try:
        result = self.client.recall(bank_id=self.bank_id, query=query)
        return [r.text for r in getattr(result, "results", [])][:limit]
    except Exception as exc:
        log.warning("Hindsight recall failed: %s", exc)
        return []
```

Finally, where memory touches a number. In `backend/engine/risk_scoring.py`, a match is capped, and zeroed
when timestamps show the feature is safe:

```python
if match:
    mem = (MEMORY_ONLY_CAP if f.status == "unverified" else MEMORY_BOOST) * match.similarity
    if f.status == "safe":
        mem = 0.0  # timestamps prove it is safe here; memory is shown as context only
```

Memory may do more only for a column with *no* availability timestamp: a strong match raises it to "needs
review" (up to 45), never to "leaked".

## Lessons learned

**Memory is not chat history.** Storing whole audit transcripts would have been easy and nearly useless. The
useful unit is an incident: one feature, one dataset, measured delays, and a one-sentence lesson. Small,
structured memories are searchable and easy to trust.

**Useful memory needs context, not just a match.** A similarity score of 0.57 is a number. "In Q1, this
signal arrived a median of 6.5 days after scoring, in every decision" is something a person can act on. I
generate lessons from measured facts, so the context is never invented.

**Evidence and memory need different permissions.** Evidence decides; memory advises. The one rule that made
the system explainable is that memory can raise attention but can never clear or convict a feature on its
own. An early version of the local vectors rated `customer_risk_score` 0.58 similar to a leaked
`merchant_risk_score`, above the match threshold, purely because both end in "risk score". Dropping generic
tokens brought that down to about 0.40. Similar names are a reason to look, not proof.

**Bookkeeping is most of the work.** Reliability came from:
- searching before writing;
- excluding a dataset's own history;
- updating incidents instead of duplicating them;
- retaining each lesson once;
- degrading quietly when an external service is down.

**Preventing a repeat is harder than finding the first one.** Detection is a comparison of two timestamps.
Recognising the same mistake under a new name, from a different team, months later, is a knowledge problem.
It needs state that outlives any single run.

## Conclusion

An auditor without memory has perfect recall of rules and none of experience. It will find your leak, and it
will find it again next quarter, just as surprised.

The version of ChronoGuard I trust keeps both: timestamps that settle what happened, and a memory that says
"we've been here before" when it genuinely has. When that memory is wrong, or silent, the timestamps still
settle the question.
