"""Feature-name embeddings for similarity search.

* Local (always available): a stateless hashed vector of expanded word tokens
  plus character n-grams. Catches renames and abbreviations
  (``cb_resolution_flag`` ~ ``chargeback_filed``) without any network access.
* Azure OpenAI (optional): real semantic embeddings, used when configured.
  Catches synonyms that share no characters.
"""

from __future__ import annotations

import logging
import re

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

from config import get_settings

log = logging.getLogger(__name__)

# Generic data-engineering abbreviations (not dataset specific).
ABBREVIATIONS = {
    "cb": "chargeback",
    "chbk": "chargeback",
    "txn": "transaction",
    "tx": "transaction",
    "trx": "transaction",
    "amt": "amount",
    "acct": "account",
    "acc": "account",
    "cust": "customer",
    "pmt": "payment",
    "pay": "payment",
    "stl": "settlement",
    "settle": "settlement",
    "stat": "status",
    "rev": "revision",
    "qty": "quantity",
    "num": "number",
    "cnt": "count",
    "avg": "average",
    "dt": "date",
    "ts": "timestamp",
    "ref": "refund",
    "disp": "dispute",
    "res": "resolution",
    "resol": "resolution",
    "fin": "final",
    "mrch": "merchant",
    "merch": "merchant",
    "dev": "device",
    "vel": "velocity",
    "bal": "balance",
    "gdp": "gross domestic product",
    "cpi": "consumer price index",
    "yoy": "year over year",
    "mom": "month over month",
}

# Generic suffixes that say little about what a column means; they are dropped before
# embedding so "customer_risk_score" is not "similar" to "merchant_risk_score" just
# because both end in "score".
GENERIC_TOKENS = {
    "score",
    "flag",
    "value",
    "rate",
    "level",
    "index",
    "count",
    "number",
    "total",
    "id",
    "indicator",
    "feature",
    "is",
    "has",
    "the",
    "of",
    "val",
    "pct",
    "percent",
    "ratio",
    "type",
    "code",
}

_WORD = HashingVectorizer(n_features=2**12, analyzer="word", alternate_sign=False, norm=None)
_CHAR = HashingVectorizer(n_features=2**12, analyzer="char_wb", ngram_range=(3, 4), alternate_sign=False, norm=None)


def humanize(name: str) -> str:
    """'cbResolution_FLAG' -> 'chargeback resolution flag'."""
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", str(name))
    tokens = [t for t in re.split(r"[^A-Za-z0-9]+", s.lower()) if t]
    return " ".join(ABBREVIATIONS.get(t, t) for t in tokens)


def _core(name: str) -> str:
    words = humanize(name).split()
    core = [w for w in words if w not in GENERIC_TOKENS]
    return " ".join(core or words)


def local_embed(names: list[str]) -> list[list[float]]:
    texts = [_core(n) for n in names]
    word = _WORD.transform(texts).toarray()
    char = _CHAR.transform(texts).toarray()
    vec = np.hstack([word * 1.0, char * 0.5])
    norms = np.linalg.norm(vec, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (vec / norms).round(6).tolist()


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if not na or not nb:
        return 0.0
    return float(va @ vb / (na * nb))


class AzureEmbedder:
    """Azure OpenAI embeddings. ``available`` is False when not configured or unreachable."""

    def __init__(self) -> None:
        s = get_settings()
        self.client = None
        self.deployment = s.azure_openai_embedding_deployment
        if s.azure_openai_endpoint and s.azure_openai_api_key and self.deployment:
            try:
                from openai import AzureOpenAI

                self.client = AzureOpenAI(
                    azure_endpoint=s.azure_openai_endpoint,
                    api_key=s.azure_openai_api_key,
                    api_version=s.azure_openai_api_version,
                    timeout=20,
                )
            except Exception as exc:  # pragma: no cover - depends on environment
                log.warning("Azure OpenAI embeddings disabled: %s", exc)

    @property
    def available(self) -> bool:
        return self.client is not None

    def embed(self, names: list[str]) -> list[list[float]] | None:
        if not self.client or not names:
            return None
        try:
            resp = self.client.embeddings.create(model=self.deployment, input=[humanize(n) for n in names])
            return [d.embedding for d in resp.data]
        except Exception as exc:  # network / auth errors -> caller falls back to local vectors
            log.warning("Azure OpenAI embedding call failed, using local vectors: %s", exc)
            return None
