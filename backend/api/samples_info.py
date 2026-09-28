"""The bundled synthetic datasets.

``seed`` samples are audited on first start so memory begins with some history. The two
demo samples are deliberately *not* seeded: the demo shows ChronoGuard learning from the
first fraud model and recognising the same failure in the second.
"""

SAMPLES: dict[str, dict] = {
    "fraud_model_v1.csv": {
        "title": "Card fraud model · v1",
        "description": "7,200 scored card transactions, 32 columns. Post-outcome investigation and chargeback "
        "fields were joined into the training table. Synthetic.",
        "model": "Card fraud classifier",
        "group": "demo",
        "seed": False,
    },
    "fraud_model_v2.csv": {
        "title": "Card fraud model · v2",
        "description": "7,400 transactions from the next model iteration. Another team rebuilt the table and "
        "renamed the same post-outcome fields. Synthetic.",
        "model": "Card fraud classifier",
        "group": "demo",
        "seed": False,
    },
    "retail_demand_forecast.csv": {
        "title": "Retail stock-out forecast",
        "description": "3,200 store-day forecasts where future sales aggregates were joined in. Synthetic.",
        "model": "Stock-out forecaster",
        "group": "history",
        "seed": True,
    },
    "credit_default_clean.csv": {
        "title": "Credit default · clean",
        "description": "2,500 loan applications built correctly from point-in-time data. Synthetic.",
        "model": "Credit default scorer",
        "group": "history",
        "seed": True,
    },
    "fraud_detection_q1.csv": {
        "title": "Fraud detection · Q1 (long format)",
        "description": "4,000 card transactions in long format. Synthetic.",
        "model": "Card fraud classifier",
        "group": "more",
        "seed": False,
    },
    "fraud_detection_q2_wide.csv": {
        "title": "Fraud detection · Q2 (wide format)",
        "description": "3,000 transactions in wide format with renamed columns. Synthetic.",
        "model": "Card fraud classifier",
        "group": "more",
        "seed": False,
    },
}

SEED_ORDER = [name for name, info in SAMPLES.items() if info["seed"]]
