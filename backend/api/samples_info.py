"""Descriptions of the bundled synthetic datasets (in the order they are seeded)."""

SAMPLES: dict[str, dict[str, str]] = {
    "fraud_detection_q1.csv": {
        "title": "Fraud detection · Q1",
        "description": "4,000 card transactions in long format. Synthetic. Includes post-outcome signals joined "
        "into the training table.",
    },
    "credit_default_clean.csv": {
        "title": "Credit default · clean",
        "description": "2,500 loan applications built correctly from point-in-time data. Synthetic.",
    },
    "fraud_detection_q2_wide.csv": {
        "title": "Fraud detection · Q2 (renamed columns)",
        "description": "3,000 transactions in wide format from the next model iteration, with several columns "
        "renamed. Synthetic.",
    },
}
