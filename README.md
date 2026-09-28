# ChronoGuard V2 🛡️⏳

**Know What Was Knowable.**

ChronoGuard audits historical ML experiments for temporal data leakage. It checks whether a feature was actually available at the prediction time, explains the leakage impact, and uses Hindsight memory to retain lessons, recall similar leakage patterns on future datasets, and reflect on whether new knowledge changes previous experiment assessments.

## MVP workflow

1. Upload/run a historical experiment.
2. Temporal Auditor reconstructs feature availability.
3. Leakage Detector identifies future information.
4. Impact Analyzer compares reported vs corrected performance.
5. Hindsight RETAIN stores the learned leakage experience.
6. A later experiment uses Hindsight RECALL to identify similar patterns.
7. New knowledge triggers REFLECT + historical re-audit.

## Architecture

```text
React UI
   |
FastAPI backend
   |
   +--> Temporal Audit Engine
   +--> Leakage Detector
   +--> Impact Analyzer
   +--> PostgreSQL (timeline/source-of-truth)
   +--> Hindsight (experience memory)
```

## Run the first MVP

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open `http://127.0.0.1:8000/docs`.

### Environment

Copy `.env.example` to `.env` and add your Hindsight API key when ready. The detector itself works in demo mode without Hindsight.

## Hindsight

Current Hindsight APIs expose `retain`, `recall`, and `reflect`. This project deliberately keeps deterministic temporal facts outside Hindsight and stores reusable lessons in the memory bank.
