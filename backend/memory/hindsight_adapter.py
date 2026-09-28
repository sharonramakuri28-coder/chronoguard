"""Optional Hindsight adapter.

Enabled only when CHRONOGUARD_HINDSIGHT_BASE_URL and CHRONOGUARD_HINDSIGHT_API_KEY
are set *and* the ``hindsight-client`` package is installed. ChronoGuard never
requires it: the SQL incident store is the source of truth; Hindsight adds
long-term organizational recall on top.
"""

from __future__ import annotations

import logging

from config import get_settings

log = logging.getLogger(__name__)


class HindsightAdapter:
    def __init__(self) -> None:
        s = get_settings()
        self.bank_id = s.hindsight_bank_id
        self.client = None
        self.error: str | None = None
        if not (s.hindsight_base_url and s.hindsight_api_key):
            return
        try:
            from hindsight_client import Hindsight  # type: ignore[import-not-found]

            self.client = Hindsight(base_url=s.hindsight_base_url, api_key=s.hindsight_api_key)
        except Exception as exc:
            self.error = f"Hindsight unavailable: {exc}"
            log.warning(self.error)

    @property
    def configured(self) -> bool:
        return self.client is not None

    def retain(self, content: str, context: str = "ChronoGuard temporal leakage incident") -> bool:
        if not self.client:
            return False
        try:
            self.client.retain(bank_id=self.bank_id, content=content, context=context)
            return True
        except Exception as exc:
            log.warning("Hindsight retain failed: %s", exc)
            return False

    def recall(self, query: str, limit: int = 3) -> list[str]:
        if not self.client:
            return []
        try:
            result = self.client.recall(bank_id=self.bank_id, query=query)
            return [r.text for r in getattr(result, "results", [])][:limit]
        except Exception as exc:
            log.warning("Hindsight recall failed: %s", exc)
            return []
