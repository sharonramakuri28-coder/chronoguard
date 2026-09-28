"""Optional Hindsight adapter.

Enabled only when CHRONOGUARD_HINDSIGHT_BASE_URL and CHRONOGUARD_HINDSIGHT_API_KEY
are set *and* the ``hindsight-client`` package is installed. ChronoGuard never
requires it: the SQL incident store is the source of truth; Hindsight adds
long-term organizational recall on top. Every call is bounded by a timeout and
fails closed, so an unreachable Hindsight never breaks an audit.
"""

from __future__ import annotations

import logging
import threading
import time

from config import get_settings

log = logging.getLogger(__name__)

# Health states reported by /api/health.
DISABLED = "disabled"  # base URL or API key not set
PACKAGE_MISSING = "package_missing"  # hindsight-client not installed
CONFIGURED = "configured"  # client created; connectivity not confirmed yet
CONNECTED = "connected"  # last call or probe reached Hindsight and was authorized
CONNECTION_FAILED = "connection_failed"  # last call or probe failed

PROBE_TIMEOUT_SECONDS = 3.0  # connectivity probe used by the health check
PROBE_MAX_AGE_SECONDS = 60.0  # re-probe at most once a minute
PROBE_WAIT_SECONDS = 1.5  # the health check never blocks longer than this
FAILURE_BACKOFF_SECONDS = 60.0  # after a failure, skip Hindsight calls this long instead of retrying each time

# Last known connectivity, shared by all adapters (each request builds its own).
_lock = threading.Lock()
_state: dict = {"key": None, "status": None, "detail": None, "at": 0.0, "probing": False}


def _reset_state() -> None:
    """Forget the cached connectivity status (used by tests)."""
    with _lock:
        _state.update(key=None, status=None, detail=None, at=0.0, probing=False)


def _describe(exc: Exception) -> str:
    status = getattr(exc, "status", None)
    if status in (401, 403):
        return f"Hindsight rejected the API key (HTTP {status})."
    if status:
        return f"Hindsight returned HTTP {status}."
    return f"Could not reach Hindsight: {type(exc).__name__}: {exc}"[:300]


class HindsightAdapter:
    def __init__(self) -> None:
        s = get_settings()
        self.bank_id = s.hindsight_bank_id
        self.base_url = s.hindsight_base_url
        self._api_key = s.hindsight_api_key
        self._timeout = s.hindsight_timeout_seconds
        self.client = None
        self.status = DISABLED
        self.error: str | None = None
        if not (self.base_url and self._api_key):
            return
        try:
            from hindsight_client import Hindsight  # type: ignore[import-not-found]
        except ImportError as exc:
            self.status = PACKAGE_MISSING
            self.error = f"hindsight-client is not installed: {exc}"
            log.warning(self.error)
            return
        self._client_cls = Hindsight
        try:
            self.client = Hindsight(base_url=self.base_url, api_key=self._api_key, timeout=self._timeout)
            self.status = CONFIGURED
        except Exception as exc:
            self.status = CONNECTION_FAILED
            self.error = f"Hindsight client could not be created: {exc}"
            log.warning(self.error)

    @property
    def configured(self) -> bool:
        return self.client is not None

    # ------------------------------------------------------------ connectivity
    @property
    def _key(self) -> tuple:
        return (self.base_url, self.bank_id)

    def _record(self, status: str, detail: str | None) -> None:
        with _lock:
            _state.update(key=self._key, status=status, detail=detail, at=time.monotonic())

    def _probe(self) -> None:
        """One cheap authenticated read. A 404 (bank not created yet) still proves connectivity."""
        try:
            probe = self._client_cls(base_url=self.base_url, api_key=self._api_key, timeout=PROBE_TIMEOUT_SECONDS)
            try:
                probe.list_memories(bank_id=self.bank_id, limit=1)
                self._record(CONNECTED, None)
            except Exception as exc:
                if getattr(exc, "status", None) == 404:
                    self._record(CONNECTED, "Memory bank not created yet; it is created on the first retain.")
                else:
                    self._record(CONNECTION_FAILED, _describe(exc))
            finally:
                try:
                    probe.close()
                except Exception:
                    pass
        except Exception as exc:
            self._record(CONNECTION_FAILED, _describe(exc))
        finally:
            with _lock:
                _state["probing"] = False

    def _backing_off(self) -> bool:
        """True shortly after a failed call or probe, so one outage costs an audit one timeout, not many."""
        with _lock:
            return (
                _state["key"] == self._key
                and _state["status"] == CONNECTION_FAILED
                and time.monotonic() - _state["at"] < FAILURE_BACKOFF_SECONDS
            )

    def close(self) -> None:
        """Release the client's HTTP session (one adapter lives for one request)."""
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass

    def connection_status(self) -> tuple[str, str | None]:
        """Fast health status. Probes in the background at most once a minute; waits ≤1.5 s."""
        if not self.configured:
            return self.status, self.error
        thread = None
        with _lock:
            fresh = _state["key"] == self._key and time.monotonic() - _state["at"] < PROBE_MAX_AGE_SECONDS
            if not fresh and not _state["probing"]:
                _state["probing"] = True
                thread = threading.Thread(target=self._probe, daemon=True)
        if thread:
            thread.start()
            thread.join(PROBE_WAIT_SECONDS)
        with _lock:
            if _state["key"] == self._key and _state["status"]:
                return _state["status"], _state["detail"]
        return CONFIGURED, "Connection check in progress."

    # ------------------------------------------------------------ memory calls
    def retain(self, content: str, context: str = "ChronoGuard temporal leakage incident") -> bool:
        if not self.client or self._backing_off():
            return False
        try:
            self.client.retain(bank_id=self.bank_id, content=content, context=context)
            self._record(CONNECTED, None)
            return True
        except Exception as exc:
            log.warning("Hindsight retain failed: %s", exc)
            self._record(CONNECTION_FAILED, _describe(exc))
            return False

    def recall(self, query: str, limit: int = 3) -> list[str]:
        if not self.client or self._backing_off():
            return []
        try:
            result = self.client.recall(bank_id=self.bank_id, query=query)
            self._record(CONNECTED, None)
            return [r.text for r in getattr(result, "results", [])][:limit]
        except Exception as exc:
            log.warning("Hindsight recall failed: %s", exc)
            self._record(CONNECTION_FAILED, _describe(exc))
            return []
