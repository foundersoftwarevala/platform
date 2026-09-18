"""MADLAD-400 3B (Apache-2.0) through CTranslate2, on CPU.

One translator per process. Calls are serialised with a lock: the host has
few cores and a web application to share them with, so the model runs one
batch at a time on a fixed number of threads.
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

log = logging.getLogger("sv_translate.madlad")

REQUIRED_FILES = ("model.bin", "config.json", "shared_vocabulary.json", "spiece.model")


class ModelNotReady(RuntimeError):
    pass


class ModelBusy(RuntimeError):
    pass


class MadladBackend:
    name = "madlad400-3b-mt-ct2-int8"

    def __init__(self, model_dir: Path, intra_threads: int, max_batch: int) -> None:
        self.model_dir = model_dir
        self.intra_threads = intra_threads
        self.max_batch = max_batch
        self._translator = None
        self._sp = None
        self._lock = threading.Lock()
        # How many interactive requests are waiting for the model. Background
        # work checks this between batches and steps aside.
        self._waiting = 0
        self._waiting_lock = threading.Lock()
        self._ready = threading.Event()
        self.error: str | None = None
        self.load_seconds: float | None = None
        revision_file = model_dir / "REVISION"
        self.revision = revision_file.read_text().strip() if revision_file.exists() else None

    @property
    def ready(self) -> bool:
        return self._ready.is_set()

    @property
    def busy(self) -> bool:
        return self._lock.locked()

    def version(self) -> str:
        return f"{self.name}@{(self.revision or 'unknown')[:12]}"

    def load(self) -> None:
        if self.ready:
            return
        try:
            missing = [f for f in REQUIRED_FILES if not (self.model_dir / f).exists()]
            if missing:
                raise FileNotFoundError(f"model files missing in {self.model_dir}: {missing}")
            import ctranslate2
            import sentencepiece as spm

            started = time.monotonic()
            self._translator = ctranslate2.Translator(
                str(self.model_dir),
                device="cpu",
                compute_type="int8",
                intra_threads=self.intra_threads,
                inter_threads=1,
            )
            self._sp = spm.SentencePieceProcessor(model_file=str(self.model_dir / "spiece.model"))
            self.load_seconds = round(time.monotonic() - started, 2)
            self.error = None
            self._ready.set()
            log.info("model loaded", extra={"seconds": self.load_seconds, "model": self.version()})
        except Exception as exc:  # noqa: BLE001 - reported through /ready
            self.error = f"{type(exc).__name__}: {exc}"
            log.exception("model load failed")

    def translate(
        self,
        texts: list[str],
        target_token: str,
        beam_size: int,
        wait_seconds: float,
        interactive: bool = True,
    ) -> list[str]:
        """Translate `texts` into the language whose MADLAD token is `target_token`.

        The model runs one batch at a time. The lock is taken per batch rather
        than per request, so a long background request (a hundred interface
        strings) never holds the model for minutes while a visitor waits: an
        interactive request gets in after at most one batch.
        """
        if not self.ready:
            raise ModelNotReady(self.error or "model is loading")

        if interactive:
            with self._waiting_lock:
                self._waiting += 1
        try:
            sp = self._sp
            translator = self._translator
            assert sp is not None and translator is not None
            order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
            results: list[str] = [""] * len(texts)
            deadline = time.monotonic() + wait_seconds
            for start in range(0, len(order), self.max_batch):
                if not interactive and self._waiting > 0:
                    # Someone is waiting for an answer on screen; let them through.
                    time.sleep(0.05)
                remaining = max(0.05, deadline - time.monotonic()) if interactive else max(1.0, wait_seconds)
                if not self._lock.acquire(timeout=remaining):
                    raise ModelBusy("model is busy")
                try:
                    chunk = order[start : start + self.max_batch]
                    batch = [sp.encode(f"<2{target_token}> {texts[i]}", out_type=str) + ["</s>"] for i in chunk]
                    longest = max(len(tokens) for tokens in batch)
                    output = translator.translate_batch(
                        batch,
                        beam_size=beam_size,
                        max_decoding_length=min(1024, int(longest * 2.5) + 10),
                        max_input_length=1024,
                        no_repeat_ngram_size=0,
                    )
                    for i, hyp in zip(chunk, output):
                        results[i] = sp.decode(hyp.hypotheses[0])
                finally:
                    self._lock.release()
            return results
        finally:
            if interactive:
                with self._waiting_lock:
                    self._waiting -= 1
