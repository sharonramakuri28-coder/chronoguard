import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .demo_data import get_demo_experiment
from .leakage import (
    analyze_csv,
    summarize_results,
    calculate_model_impact
)
from .memory import ChronoGuardMemory
from .models import Experiment


# ============================================================
# ENVIRONMENT
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from backend/.env
load_dotenv(BASE_DIR / ".env")


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="ChronoGuard API",
    version="0.2.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# HINDSIGHT MEMORY
# ============================================================

memory = ChronoGuardMemory()


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name": "ChronoGuard",
        "tagline": "Know What Was Knowable",
        "status": "running",
        "version": "0.2.0"
    }


# ============================================================
# DEMO EXPERIMENT
# ============================================================

@app.get(
    "/api/demo-experiment",
    response_model=Experiment
)
def demo_experiment():

    return get_demo_experiment()


# ============================================================
# EXPERIMENT AUDIT
# ============================================================

@app.post("/api/audit")
def audit(experiment: Experiment):

    # --------------------------------------------------------
    # Run temporal leakage audit
    # --------------------------------------------------------

    result = audit_experiment(experiment)

    memory_result = None


    # --------------------------------------------------------
    # Find leaked features
    # --------------------------------------------------------

    leakage_findings = [
        finding

        for finding in result["findings"]

        if finding["status"] == "LEAKAGE"
    ]


    # --------------------------------------------------------
    # RETAIN EXPERIENCE IN HINDSIGHT
    # --------------------------------------------------------

    if leakage_findings:

        memory_result = (
            memory.retain_leakage_experience(
                result
            )
        )


    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {

        "audit": result,

        "hindsight": memory_result

    }


# ============================================================
# HINDSIGHT RECALL
# ============================================================

@app.post("/api/recall")
def recall(query: str):

    return memory.recall_similar_patterns(
        query
    )


# ============================================================
# HINDSIGHT REFLECT
# ============================================================

@app.post("/api/reflect")
def reflect(query: str):

    return memory.reflect_on_new_rule(
        query
    )


# ============================================================
# REAL DATASET ANALYSIS
# ============================================================

@app.get("/analyze-real-data")
def analyze_real_data():

    csv_path = (
        BASE_DIR.parent
        / "data"
        / "chronoguard_financial_experiments.csv"
    )


    results = analyze_csv(
        str(csv_path)
    )


    summary = summarize_results(
        results
    )


    return {

        "summary": summary,

        "results": results

    }


# ============================================================
# MODEL IMPACT
# ============================================================

@app.get("/api/model-impact")
def model_impact():

    # --------------------------------------------------------
    # Load ChronoGuard dataset
    # --------------------------------------------------------

    csv_path = (
        BASE_DIR.parent
        / "data"
        / "chronoguard_financial_experiments.csv"
    )


    # --------------------------------------------------------
    # Analyze temporal availability
    # --------------------------------------------------------

    results = analyze_csv(
        str(csv_path)
    )


    # --------------------------------------------------------
    # Calculate model impact
    # --------------------------------------------------------

    impact = calculate_model_impact(
        results
    )


    return impact


# ============================================================
# HINDSIGHT RETAIN
# ============================================================

@app.post("/memory/retain")
def retain_memory(experience: str):

    try:

        result = memory.retain(
            experience
        )


        return {

            "success": True,

            "message":
                "ChronoGuard experience stored in Hindsight.",

            "result": result

        }


    except Exception as e:

        return {

            "success": False,

            "message":
                "Failed to store experience in Hindsight.",

            "error": str(e)

        }


# ============================================================
# TEMPORAL LEAKAGE AUDIT FUNCTION
# ============================================================

def audit_experiment(
    experiment: Experiment
):

    findings = []


    for feature in experiment.features:


        # ====================================================
        # TEMPORAL LEAKAGE
        # ====================================================

        if (
            feature.available_time
            > feature.prediction_time
        ):

            delay = (
                feature.available_time
                - feature.prediction_time
            ).total_seconds() / 3600


            findings.append({

                "feature_name":
                    feature.feature_name,

                "prediction_time":
                    feature.prediction_time,

                "available_time":
                    feature.available_time,

                "delay_hours":
                    round(delay, 2),

                "source":
                    feature.source,

                "status":
                    "LEAKAGE"

            })


        # ====================================================
        # SAFE FEATURE
        # ====================================================

        else:

            findings.append({

                "feature_name":
                    feature.feature_name,

                "prediction_time":
                    feature.prediction_time,

                "available_time":
                    feature.available_time,

                "delay_hours":
                    0,

                "source":
                    feature.source,

                "status":
                    "SAFE"

            })


    # ========================================================
    # FINAL AUDIT RESULT
    # ========================================================

    return {

        "experiment_id":
            getattr(
                experiment,
                "experiment_id",
                "UNKNOWN"
            ),

        "findings":
            findings

    }