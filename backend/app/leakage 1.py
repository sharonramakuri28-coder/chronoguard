import csv
from datetime import datetime


# ============================================================
# CSV TEMPORAL LEAKAGE ANALYSIS
# ============================================================

def analyze_csv(file_path):
    results = []

    with open(file_path, "r", encoding="utf-8") as file:

        reader = csv.DictReader(file)

        for row in reader:

            prediction_time = datetime.fromisoformat(
                row["prediction_time"]
            )

            available_time = datetime.fromisoformat(
                row["available_time"]
            )

            delay_hours = (
                available_time - prediction_time
            ).total_seconds() / 3600

            # ------------------------------------------------
            # TEMPORAL LEAKAGE RULE
            # ------------------------------------------------
            # If information became available AFTER the
            # prediction was made, the model could not have
            # legitimately known that information.
            # ------------------------------------------------

            if available_time > prediction_time:
                status = "LEAKAGE"
            else:
                status = "SAFE"

            results.append({
                "experiment_id": row["experiment_id"],
                "model_name": row["model_name"],
                "transaction_id": row["transaction_id"],
                "feature_name": row["feature_name"],
                "prediction_time": row["prediction_time"],
                "available_time": row["available_time"],
                "delay_hours": round(delay_hours, 2),
                "source": row["source"],
                "reported_accuracy": float(
                    row["reported_accuracy"]
                ),
                "status": status
            })

    return results


# ============================================================
# DATASET SUMMARY
# ============================================================

def summarize_results(results):

    total = len(results)

    leaked = [
        result
        for result in results
        if result["status"] == "LEAKAGE"
    ]

    safe = [
        result
        for result in results
        if result["status"] == "SAFE"
    ]

    leakage_features = {}

    for result in leaked:

        feature = result["feature_name"]

        if feature not in leakage_features:

            leakage_features[feature] = {
                "feature_name": feature,
                "count": 0,
                "max_delay_hours": 0
            }

        leakage_features[feature]["count"] += 1

        leakage_features[feature]["max_delay_hours"] = max(
            leakage_features[feature]["max_delay_hours"],
            result["delay_hours"]
        )

    return {
        "total_rows": total,

        "safe_rows": len(safe),

        "leaked_rows": len(leaked),

        "leakage_rate": round(
            len(leaked) / total * 100,
            2
        ) if total else 0,

        "leakage_features": list(
            leakage_features.values()
        )
    }


# ============================================================
# MODEL IMPACT
# ============================================================

def calculate_model_impact(results):

    """
    Calculate the model-impact story for the ChronoGuard demo.

    IMPORTANT:
    The current CSV contains reported_accuracy but does not
    contain ground-truth labels and model predictions.

    Therefore a mathematically valid corrected model accuracy
    cannot be calculated from the CSV alone.

    For the current hackathon demo we use:

        Before audit = reported accuracy from the dataset
        After audit  = 81.4% illustrative corrected scenario

    If the CSV stores accuracy as a decimal such as:

        0.978

    it is converted to:

        97.8%

    When real y_true/y_pred data is added, this function can
    be replaced with a real corrected-backtest calculation.
    """

    # ========================================================
    # EMPTY DATASET CHECK
    # ========================================================

    if not results:

        return {
            "available": False,
            "message": "No experiment records available."
        }


    # ========================================================
    # SEPARATE LEAKED AND SAFE RECORDS
    # ========================================================

    leaked_rows = [
        result
        for result in results
        if result["status"] == "LEAKAGE"
    ]

    safe_rows = [
        result
        for result in results
        if result["status"] == "SAFE"
    ]


    # ========================================================
    # GET REPORTED ACCURACY
    # ========================================================

    reported_accuracies = [
        result["reported_accuracy"]
        for result in results
        if result.get("reported_accuracy") is not None
    ]


    # ========================================================
    # CONVERT ACCURACY TO PERCENTAGE
    # ========================================================

    if reported_accuracies:

        # Calculate average reported accuracy
        before_accuracy = (
            sum(reported_accuracies)
            / len(reported_accuracies)
        )

        # ----------------------------------------------------
        # IMPORTANT FIX
        # ----------------------------------------------------
        # If the dataset stores accuracy as:
        #
        #     0.978
        #
        # convert it to:
        #
        #     97.8
        #
        # But if the dataset already stores:
        #
        #     97.8
        #
        # don't multiply again.
        # ----------------------------------------------------

        if before_accuracy <= 1:

            before_accuracy = (
                before_accuracy * 100
            )

        before_accuracy = round(
            before_accuracy,
            1
        )

    else:

        before_accuracy = 97.8


    # ========================================================
    # CORRECTED BACKTEST SCENARIO
    # ========================================================
    #
    # IMPORTANT:
    # This is an illustrative demo value because the current
    # dataset does not contain y_true and y_pred.
    #
    # It should NOT be described as a statistically calculated
    # accuracy from the current CSV.
    # ========================================================

    corrected_accuracy = 81.4


    # ========================================================
    # PERFORMANCE GAP
    # ========================================================

    performance_gap = round(
        before_accuracy - corrected_accuracy,
        2
    )


    # ========================================================
    # LEAKAGE RATE
    # ========================================================

    leakage_rate = round(
        len(leaked_rows)
        / len(results)
        * 100,
        2
    )


    # ========================================================
    # FINAL MODEL IMPACT RESPONSE
    # ========================================================

    return {

        "available": True,

        # Clearly identify that the corrected value is
        # illustrative rather than a real model calculation.
        "mode": "illustrative_demo",

        "is_real_model_accuracy": False,


        # ----------------------------------------------------
        # BEFORE
        # ----------------------------------------------------

        "before_accuracy":
            before_accuracy,

        "before_label":
            "REPORTED BACKTEST",

        "before_status":
            "INVALID IF LEAKAGE IS PRESENT",


        # ----------------------------------------------------
        # AFTER
        # ----------------------------------------------------

        "after_accuracy":
            corrected_accuracy,

        "after_label":
            "CORRECTED BACKTEST",

        "after_status":
            "ILLUSTRATIVE SCENARIO",


        # ----------------------------------------------------
        # IMPACT
        # ----------------------------------------------------

        "performance_gap":
            performance_gap,


        # ----------------------------------------------------
        # DATASET INFORMATION
        # ----------------------------------------------------

        "leakage_rate":
            leakage_rate,

        "total_records":
            len(results),

        "leaked_records":
            len(leaked_rows),

        "safe_records":
            len(safe_rows),


        # ----------------------------------------------------
        # EXPLANATION
        # ----------------------------------------------------

        "message": (
            "Illustrative corrected-backtest impact. "
            "The current CSV contains prediction-time "
            "availability information and reported accuracy, "
            "but it does not contain model predictions and "
            "ground-truth labels. Therefore the corrected "
            "81.4% value is not statistically calculated "
            "from this CSV."
        )

    }