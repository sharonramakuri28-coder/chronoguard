"""ChronoGuard API entry point. Run from backend/: `uvicorn main:app --reload`."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.pipeline import seed_samples
from api.routes import router
from config import get_settings
from database.session import SessionLocal, init_db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
settings = get_settings()


def _seed() -> None:
    with SessionLocal() as db:
        seed_samples(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.seed_samples_on_startup:
        # A worker thread, not the event loop: the Hindsight client's sync calls cannot run inside a running loop.
        await asyncio.to_thread(_seed)
    yield


app = FastAPI(
    title="ChronoGuard API",
    version="1.0.0",
    description="Detects temporal data leakage in ML datasets and measures its impact on model performance.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
