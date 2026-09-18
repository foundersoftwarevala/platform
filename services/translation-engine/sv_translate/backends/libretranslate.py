"""The self-hosted LibreTranslate container (Argos Translate models).

A second, faster local backend for the languages it covers. It runs on the
same host (127.0.0.1) and is not a third-party service.
"""

from __future__ import annotations

import threading
import time

import httpx


class LibreTranslateBackend:
    name = "libretranslate-argos"

    def __init__(self, base_url: str, timeout: float = 45.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        self._languages: set[str] | None = None
        self._checked_at = 0.0
        self._lock = threading.Lock()
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
    def ready(self) -> bool:
        return bool(self.languages())

    def supports(self, source: str | None, target: str) -> bool:
        langs = self.languages()
        return target in langs and (source is None or source in langs)

    def version(self) -> str:
        return self.name

    def translate(self, texts: list[str], source: str | None, target: str) -> list[str]:
        response = self._client.post(
            f"{self.base_url}/translate",
            json={"q": texts, "source": source or "auto", "target": target, "format": "text"},
        )
        response.raise_for_status()
        payload = response.json()
        translated = payload.get("translatedText")
        if not isinstance(translated, list) or len(translated) != len(texts):
            raise RuntimeError("LibreTranslate returned an unexpected reply")
        return [str(t) for t in translated]
