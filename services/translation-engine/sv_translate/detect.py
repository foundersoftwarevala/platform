"""Language identification with fastText lid.176 (176 languages).

Used to detect the language of text whose source language is unknown and to
check that a translation is in the language that was asked for.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

log = logging.getLogger("sv_translate.detect")


class Detector:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._model = None
        self._lock = threading.Lock()
        self.labels: set[str] = set()
        self.error: str | None = None

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            try:
                import fasttext

                fasttext.FastText.eprint = lambda *args, **kwargs: None  # silence load warning
                self._model = fasttext.load_model(str(self.path))
                self.labels = {label.replace("__label__", "") for label in self._model.get_labels()}
                self.error = None
            except Exception as exc:  # noqa: BLE001
                self.error = f"{type(exc).__name__}: {exc}"
                log.exception("detector load failed")

    @property
    def ready(self) -> bool:
        return self._model is not None

    def detect(self, text: str, k: int = 3) -> list[tuple[str, float]]:
        if self._model is None:
            self.load()
        if self._model is None:
            return []
        line = " ".join(text.split())
        if not line:
            return []
        labels, probs = self._model.predict(line, k=k)
        return [(label.replace("__label__", ""), float(prob)) for label, prob in zip(labels, probs)]
