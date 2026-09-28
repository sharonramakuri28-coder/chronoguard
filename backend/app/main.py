import csv
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
# DATASET PATHS
# ============================================================

FEATURE_METADATA_FILE = (
    BASE_DIR.parent
    / "data"
    / "chronoguard_final_feature_metadata.csv"
)


HISTORICAL_EXPERIMENTS_FILE = (
    BASE_DIR.parent
    / "data"
    / "chronoguard_historical_experiments.csv"
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
# HISTORICAL EXPERIMENTS
# ============================================================

@app.get("/api/experiments")
def get_historical_experiments():

    experiments = []


    with open(
        HISTORICAL_EXPERIMENTS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        reader = csv.DictReader(
            file
        )


        for row in reader:

            experiments.append(
                row
            )


    return {

        "count":
            len(experiments),

        "experiments":
            experiments

    }


# ============================================================
# KNOWLEDGE-DRIVEN RE-AUDIT
# ============================================================

@app.post("/api/knowledge/re-audit")
def knowledge_re_audit():

    # --------------------------------------------------------
    # STEP 1
    # Read the latest feature knowledge
    # --------------------------------------------------------

    results = analyze_csv(
        str(FEATURE_METADATA_FILE)
    )


    # --------------------------------------------------------
    # STEP 2
    # Identify features known to contain
    # temporal leakage
    # --------------------------------------------------------

    leaked_features = {

        result["feature_name"]

        for result in results

        if result["status"] == "LEAKAGE"

    }


    # --------------------------------------------------------
    # STEP 3
    # Search historical experiments
    # --------------------------------------------------------

    affected_experiments = []


    with open(
        HISTORICAL_EXPERIMENTS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        reader = csv.DictReader(
            file
        )


        for row in reader:

            feature_name = (
                row["feature_name"]
            )


            if feature_name in leaked_features:

                affected_experiments.append({

                    "experiment_id":
                        row["experiment_id"],

                    "model_name":
                        row["model_name"],

                    "feature_name":
                        feature_name,

                    "decision_date":
                        row["decision_date"],

                    "reason":
                        (
                            "This feature is now known "
                            "to be unavailable at the "
                            "original decision time."
                        ),

                    "action":
                        "RE-AUDIT REQUIRED"

                })


    # --------------------------------------------------------
    # STEP 4
    # Return knowledge-driven results
    # --------------------------------------------------------

    return {

        "knowledge_update":
            (
                "ChronoGuard applied the learned "
                "temporal-leakage rules to "
                "historical experiments."
            ),

        "leaked_feature_count":
            len(leaked_features),

        "affected_experiment_count":
            len(affected_experiments),

        "affected_experiments":
            affected_experiments

    }


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

        # ----------------------------------------------------
        # Feature became available AFTER prediction time
        # ----------------------------------------------------

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


        # ----------------------------------------------------
        # Feature was available at prediction time
        # ----------------------------------------------------

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


    # --------------------------------------------------------
    # Final audit result
    # --------------------------------------------------------

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