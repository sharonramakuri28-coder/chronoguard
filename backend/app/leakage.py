import csv


# ============================================================
# FEATURE METADATA TEMPORAL LEAKAGE ANALYSIS
# ============================================================

def analyze_csv(file_path):

    results = []

    with open(
        file_path,
        "r",
        encoding="utf-8"
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            available_value = (
                row["available_at_decision_time"]
                .strip()
                .upper()
            )

            # ------------------------------------------------
            # TEMPORAL LEAKAGE RULE
            # ------------------------------------------------
            #
            # YES = information was available at decision time
            # NO  = information was NOT available at decision time
            #
            # Therefore:
            #
            # YES -> SAFE
            # NO  -> LEAKAGE
            # ------------------------------------------------

            if available_value == "YES":

                status = "SAFE"

            else:

                status = "LEAKAGE"


            results.append({

                "feature_name":
                    row["feature_name"],

                "available_at_decision_time":
                    available_value,

                "risk_level":
                    row["risk_level"],

                "explanation":
                    row["explanation"],

                "status":
                    status

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


    leakage_features = []

    for result in leaked:

        leakage_features.append({

            "feature_name":
                result["feature_name"],

            "risk_level":
                result["risk_level"],

            "explanation":
                result["explanation"]

        })


    return {

        "total_features":
            total,

        "safe_features":
            len(safe),

        "leaked_features":
            len(leaked),

        "leakage_rate":
            round(
                len(leaked) / total * 100,
                2
            ) if total else 0,

        "safe_feature_names": [
            result["feature_name"]
            for result in safe
        ],

        "leakage_feature_names": [
            result["feature_name"]
            for result in leaked
        ],

        "leakage_features":
            leakage_features

    }


# ============================================================
# FEATURE IMPACT
# ============================================================

def calculate_feature_impact(results):

    if not results:

        return {

            "available": False,

            "message":
                "No feature metadata available."

        }


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


    return {

        "available": True,

        "mode":
            "feature_metadata_audit",

        "total_features":
            total,

        "safe_features":
            len(safe),

        "leaked_features":
            len(leaked),

        "leakage_rate":
            round(
                len(leaked) / total * 100,
                2
            ),

        "message": (
            "ChronoGuard identified features that "
            "were unavailable at decision time. "
            "These features represent potential "
            "temporal data leakage."
        )

    }