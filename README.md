# ChronoGuard

**Your model should only know what the world knew.**

ChronoGuard audits machine-learning datasets for *temporal leakage*: feature values that were not yet
available when a prediction was made. A chargeback flag recorded a week after the transaction, a
settlement status finalized two days later, a macro indicator revised after the fact. Leakage like this
inflates offline metrics and silently fails in production.

ChronoGuard:

1. **Detects leakage from timestamps.** A feature value leaks when `available_time > prediction_time`.
   No hand-written labels are used.
2. **Scores the risk** of every feature and the dataset (0–100) with a documented formula.
3. **Remembers incidents** in a vector memory, so a leak that returns under a new column name
   (`cb_resolution_flag` ≈ `chargeback_filed`) is recognised and scored higher.
4. **Replays the model** with and without the leaked features on a time-ordered split and reports the
   measured drop in ROC-AUC, accuracy, precision, recall and F1.

Every number, chart, score and explanation in the UI is computed by the backend from the uploaded data.

## Architecture

```
React + TypeScript + Vite (Tailwind, Framer Motion, Recharts)
        │  REST (JSON)
FastAPI ├─ engine/parsing.py           CSV → normalized observations (long or wide layout)
        ├─ engine/leakage_detector.py  available_time > prediction_time, per-feature stats, timeline
        ├─ engine/risk_scoring.py      0–100 score: timestamp evidence + memory similarity
        ├─ engine/replay.py            baseline vs leak-free model, drop-one ablation
        ├─ memory/                     incident store + vector search, explanations
        │     ├─ local hashed vectors (offline, always available)
        │     ├─ Azure OpenAI embeddings + chat explanations (optional)
        │     └─ Hindsight adapter (optional)
        └─ database/ (SQLAlchemy)      SQLite by default; any SQLAlchemy URL (e.g. Azure PostgreSQL)
```

The database holds deterministic facts: datasets, audits, findings, replays and incidents with their
vectors. The optional AI services only add semantic similarity and prose. They never produce the numbers.

## Quick start

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn main:app --reload            # http://127.0.0.1:8000/docs
```

On first start the three bundled sample datasets are audited and replayed through the real engine,
so the dashboard is not empty. Set `CHRONOGUARD_SEED_SAMPLES_ON_STARTUP=false` to disable this.

**Frontend** (Node 20+):

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Set `VITE_API_URL` (see `frontend/.env.example`) if the API is not on `http://127.0.0.1:8000`.

**Checks:**

```bash
cd backend && pytest && ruff check . && ruff format --check .
cd frontend && npm run build && npm run lint
```

## Dataset format

Two CSV layouts are detected automatically. Common column names are recognised
(`prediction_time`, `decision_time`, `scored_at`, `available_time`, `known_at`, `target`, `label`, `is_fraud`, …).

**Long:** one row per (decision, feature):

```csv
decision_id,feature_name,feature_value,prediction_time,available_time,target
TXN-001,chargeback_filed,1,2026-01-10T10:00:00Z,2026-01-17T15:00:00Z,1
TXN-001,transaction_amount,84.20,2026-01-10T10:00:00Z,2026-01-10T10:00:00Z,1
```

**Wide:** one row per decision, with a `<feature>_available_time` column per feature:

```csv
transaction_id,scored_at,is_fraud,amount,amount_available_time,cb_flag,cb_flag_available_time
TX-1,2026-01-10T10:00:00Z,1,84.20,2026-01-10T10:00:00Z,1,2026-01-17T15:00:00Z
```

- Timestamps are ISO 8601. Times without a timezone are treated as UTC.
- A `target` column (binary) enables the replay. Feature values enable model training.
- Verdict-like columns (`expected_status`, `available_at_decision_time`, `risk_level`, …) are reported
  as ignored and never used as evidence.

## How the risk score works

```
feature score  = 100 × √(leak rate) × severity(median delay)  +  memory boost
severity       = 0.5 + 0.5 × min(1, log(1 + median delay h) / log(1 + 720))
memory boost   = up to +15 × similarity when a past incident matches
                 (a feature with no timestamps + a memory match alone → up to 45, "review")
dataset score  = 0.7 × max(feature scores) + 0.3 × mean(risky feature scores)
bands          = low < 25 ≤ medium < 60 ≤ high
```

A memory match is a past incident with cosine similarity ≥ 0.50 (local vectors) or ≥ 0.60 (Azure
embeddings). The same dataset never matches its own incidents.

## Replay

- Decisions are sorted by prediction time. The model trains on the earliest 70% and tests on the latest 30%.
- Two identical `HistGradientBoostingClassifier` models are trained: one on all features, one with the
  leaked features removed.
- A drop-one ablation measures each leaked feature's own contribution.
- The replay needs a binary target, both classes in each period, and at least 200 labelled decisions.
  Otherwise the API explains why no replay was run.

On the bundled synthetic `fraud_detection_q1.csv`, the replay measures ROC-AUC 0.985 with all features
versus 0.676 without the leaked ones.

## Optional integrations

All are configured in `backend/.env` (see `backend/.env.example`). Without them ChronoGuard runs fully offline.

| Integration | Enables | Settings |
|---|---|---|
| Azure OpenAI | Semantic embeddings for memory; written audit explanations grounded in the measured facts | `CHRONOGUARD_AZURE_OPENAI_*` |
| Hindsight | Long-term organizational recall alongside the SQL incident store | `CHRONOGUARD_HINDSIGHT_*` + `pip install hindsight-client` |
| PostgreSQL | Shared, durable storage (e.g. Azure Database for PostgreSQL) | `CHRONOGUARD_DATABASE_URL` + `pip install psycopg[binary]` |

The active providers are shown in the app's sidebar and at `GET /api/health`.

## Sample data

`backend/data/samples/` contains three seeded **synthetic** datasets (regenerate with
`python -m scripts.generate_samples`):

| File | Story |
|---|---|
| `fraud_detection_q1.csv` | Long layout. Chargeback and settlement outcomes were joined into the training table. |
| `credit_default_clean.csv` | Built correctly from point-in-time data. Expect a low risk score and no replay gap. |
| `fraud_detection_q2_wide.csv` | Wide layout, next model iteration, leaky columns renamed. Memory recognises the recurring leak. |

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Database status and active memory, explanation and Hindsight providers |
| POST | `/api/datasets` | Upload a CSV (multipart `file`) and get the full audit |
| GET | `/api/samples` · POST `/api/samples/{name}/audit` | Bundled samples |
| GET | `/api/audits` · `/api/audits/{id}` | Audit summaries and full reports |
| GET | `/api/audits/{id}/affected` | Paginated affected decision IDs |
| POST / GET | `/api/audits/{id}/replay` | Run or fetch the model replay |
| GET | `/api/memory/incidents` · POST `/api/memory/search` | Incident memory |
| GET | `/api/dashboard` | Aggregates across all audits |

Interactive docs: `http://127.0.0.1:8000/docs`.
