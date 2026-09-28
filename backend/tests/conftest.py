"""Test isolation: a temporary SQLite database, no seeding, and no external AI services.

Runs before any test module imports the app, so every test gets the same settings
regardless of a developer's local backend/.env.
"""

import os
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="chronoguard-test-")
os.environ["CHRONOGUARD_DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["CHRONOGUARD_UPLOAD_DIR"] = str(Path(_tmp) / "uploads")
os.environ["CHRONOGUARD_SEED_SAMPLES_ON_STARTUP"] = "false"
# Empty values override anything in backend/.env and keep optional providers disabled.
for key in (
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "HINDSIGHT_BASE_URL",
    "HINDSIGHT_API_KEY",
):
    os.environ[f"CHRONOGUARD_{key}"] = ""
