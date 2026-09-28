"""Runtime settings, read from environment variables (or backend/.env)."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_prefix="CHRONOGUARD_", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'chronoguard.db'}"
    upload_dir: Path = BACKEND_DIR / "storage" / "uploads"
    samples_dir: Path = BACKEND_DIR / "data" / "samples"
    max_upload_mb: int = 20
    # Comma-separated list of allowed browser origins, e.g. "https://chronoguard.vercel.app".
    # "*" (default) allows any origin: the API uses no cookies or credentials. In local
    # development the Vite dev server proxies /api, so no CORS entry is needed.
    cors_origins: Annotated[list[str], NoDecode] = ["*"]
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
    # Upper bound for each Hindsight call made during an audit (the client default is 300 s).
    hindsight_timeout_seconds: float = 10.0

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):  # also accept a JSON list
                import json

                return json.loads(v)
            return [o.strip().rstrip("/") for o in v.split(",") if o.strip()] or ["*"]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
