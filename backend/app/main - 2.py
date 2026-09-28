from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .demo_data import get_demo_experiment
from .leakage import (
    analyze_csv,
    summarize_results,
    calculate_feature_impact
)
from .memory import ChronoGuardMemory
from .models import Experiment


# ============================================================
# ENVIRONMENT
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(
    BASE_DIR / ".env"
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="ChronoGuard API",
    version="0.3.0"
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

    allow_headers=["*"]

)


# ============================================================
# HINDSIGHT MEMORY
# ============================================================

memory = ChronoGuardMemory()


# ============================================================
# DATASET PATH
# ============================================================

FEATURE_METADATA_FILE = (
    BASE_DIR.parent
    / "data"
    / "chronoguard_final_feature_metadata.csv"
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {

        "name":
            "ChronoGuard",

        "tagline":
            "Know What Was Knowable",

        "status":
            "running",

        "version":
            "0.3.0"

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
def audit(
    experiment: Experiment
):

    result = audit_experiment(
        experiment
    )

    memory_result = None


    leakage_findings = [

        finding

        for finding in result["findings"]

        if finding["status"] == "LEAKAGE"

    ]


    if leakage_findings:

        memory_result = (
            memory.retain_leakage_experience(
                result
            )
        )


    return {

        "audit":
            result,

        "hindsight":
            memory_result

    }


# ============================================================
# FEATURE METADATA ANALYSIS
# ============================================================

@app.get("/analyze-real-data")
def analyze_real_data():

    results = analyze_csv(
        str(FEATURE_METADATA_FILE)
    )

    summary = summarize_results(
        results
    )

    return {

        "summary":
            summary,

        "results":
            results

    }


# ============================================================
# FEATURE IMPACT
# ============================================================

@app.get("/api/model-impact")
def model_impact():

    results = analyze_csv(
        str(FEATURE_METADATA_FILE)
    )

    impact = calculate_feature_impact(
        results
    )

    return impact


# ============================================================
# HINDSIGHT RECALL
# ============================================================

@app.post("/api/recall")
def recall(
    query: str
):

    return memory.recall_similar_patterns(
        query
    )


# ============================================================
# HINDSIGHT REFLECT
# ============================================================

@app.post("/api/reflect")
def reflect(
    query: str
):

    return memory.reflect_on_new_rule(
        query
    )


# ============================================================
# HINDSIGHT RETAIN
# ============================================================

@app.post("/memory/retain")
def retain_memory(
    experience: str
):

    try:

        result = memory.retain(
            experience
        )

        return {

            "success":
                True,

            "message":
                "ChronoGuard experience stored in Hindsight.",

            "result":
                result

        }

    except Exception as e:

        return {

            "success":
                False,

            "message":
                "Failed to store experience in Hindsight.",

            "error":
                str(e)

        }


# ============================================================
# TEMPORAL LEAKAGE AUDIT
# ============================================================

def audit_experiment(
    experiment: Experiment
):

    findings = []


    for feature in experiment.features:

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
                    round(
                        delay,
                        2
                    ),

                "source":
                    feature.source,

                "status":
                    "LEAKAGE"

            })


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