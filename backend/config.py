"""Runtime settings, read from environment variables (or backend/.env)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_prefix="CHRONOGUARD_", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'chronoguard.db'}"
    upload_dir: Path = BACKEND_DIR / "storage" / "uploads"
    samples_dir: Path = BACKEND_DIR / "data" / "samples"
    max_upload_mb: int = 20
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    seed_samples_on_startup: bool = True

    # Optional Azure OpenAI (embeddings + explanations). Unset -> local fallback.
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_embedding_deployment: str | None = None
    azure_openai_chat_deployment: str | None = None

    # Optional Hindsight adapter. Unset -> disabled.
    hindsight_base_url: str | None = None
    hindsight_api_key: str | None = None
    hindsight_bank_id: str = "chronoguard"


@lru_cache
def get_settings() -> Settings:
    return Settings()
