"""The self-hosted LibreTranslate container (Argos Translate models).

A second, faster local backend for the languages it covers. It runs on the
same host (127.0.0.1) and is not a third-party service.

It is a fallback only: the engine uses it when the model is busy with an
interactive request, and a failure here moves the request on to the model.
A circuit breaker keeps a failing container out of the way: its workers have
been seen segfaulting and being killed for memory under load, and without it
every request paid for a failed call (up to the timeout) before the model
was tried.
"""

from __future__ import annotations

import threading
import time

import httpx


class LibreTranslateBackend:
    name = "libretranslate-argos"

    # The fallback must answer well inside the application's 60 s budget, or
    # the request fails anyway; a slower answer counts as a failure.
    TRANSLATE_TIMEOUT = 15.0
    # After FAILURES_TO_OPEN failures within FAILURE_WINDOW seconds the backend
    # is not used for OPEN_SECONDS.
    FAILURES_TO_OPEN = 3
    FAILURE_WINDOW = 60.0
    OPEN_SECONDS = 120.0

    def __init__(self, base_url: str, timeout: float = TRANSLATE_TIMEOUT) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        self._languages: set[str] | None = None
        self._checked_at = 0.0
        self._lock = threading.Lock()
        self._failures: list[float] = []
        self._open_until = 0.0
        self.error: str | None = None

    # A good answer is trusted for a while; a failure is retried soon, because
    # the container can simply have been busy (it answers slowly when idle).
    GOOD_TTL = 300.0
    FAILED_TTL = 20.0

    def languages(self) -> set[str]:
        with self._lock:
            ttl = self.GOOD_TTL if self._languages else self.FAILED_TTL
            if self._languages is not None and time.monotonic() - self._checked_at < ttl:
                return self._languages
            try:
                response = self._client.get(f"{self.base_url}/languages", timeout=45.0)
                response.raise_for_status()
                self._languages = {entry["code"] for entry in response.json()}
                self.error = None
            except Exception as exc:  # noqa: BLE001
                self.error = f"{type(exc).__name__}: {exc}"
                self._languages = self._languages or set()
            self._checked_at = time.monotonic()
            return self._languages

    @property
    def open(self) -> bool:
        """True while the circuit breaker keeps this backend out of use."""
        return time.monotonic() < self._open_until

    def _failed(self) -> None:
        now = time.monotonic()
        with self._lock:
            self._failures = [t for t in self._failures if now - t < self.FAILURE_WINDOW] + [now]
            if len(self._failures) >= self.FAILURES_TO_OPEN:
                self._open_until = now + self.OPEN_SECONDS
                self._failures = []
                self.error = f"circuit open for {int(self.OPEN_SECONDS)} s after repeated failures"

    @property
    def ready(self) -> bool:
        return not self.open and bool(self.languages())

    def supports(self, source: str | None, target: str) -> bool:
        if self.open:
            return False
        langs = self.languages()
        return target in langs and (source is None or source in langs)

    def version(self) -> str:
        return self.name

    def translate(self, texts: list[str], source: str | None, target: str) -> list[str]:
        if self.open:
            raise RuntimeError("LibreTranslate circuit is open")
        try:
            response = self._client.post(
                f"{self.base_url}/translate",
                json={"q": texts, "source": source or "auto", "target": target, "format": "text"},
            )
            response.raise_for_status()
            payload = response.json()
            translated = payload.get("translatedText")
            if not isinstance(translated, list) or len(translated) != len(texts):
                raise RuntimeError("LibreTranslate returned an unexpected reply")
        except Exception:
            self._failed()
            raise
        return [str(t) for t in translated]
