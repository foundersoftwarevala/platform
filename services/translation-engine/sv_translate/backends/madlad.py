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


# Longest a background batch waits for interactive requests before it goes ahead.
BACKGROUND_YIELD_SECONDS = 30.0


class ModelBusy(RuntimeError):
    pass


class MadladBackend:
    name = "madlad400-3b-mt-ct2-int8"

    def __init__(
        self, model_dir: Path, intra_threads: int, max_batch: int, background_batch: int = 2
    ) -> None:
        self.model_dir = model_dir
        self.intra_threads = intra_threads
        self.max_batch = max_batch
        # Background work decodes a few segments at a time, so a visitor waits
        # for at most one small batch (a batch of eight long catalogue strings
        # in quality mode held the model for 20-60 s, measured).
        self.background_batch = max(1, background_batch)
        self._translator = None
        self._sp = None
        self._lock = threading.Lock()
        # How many interactive requests are waiting for the model. Background
        # work checks this between batches and steps aside.
        self._waiting = 0
        self._waiting_lock = threading.Lock()
        # Interactive requests waiting for a shared batch (see _translate_interactive).
        self._pending: list[_Pending] = []
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

        The model runs one batch at a time. Interactive requests (a visitor
        waiting) share batches with each other (_translate_interactive).
        Background work takes the model a small batch at a time and stands
        aside while any visitor is waiting, so a long background request never
        holds the model while someone waits for an answer on screen.
        """
        if not self.ready:
            raise ModelNotReady(self.error or "model is loading")
        if interactive:
            return self._translate_interactive(texts, target_token, beam_size, wait_seconds)

        sp = self._sp
        translator = self._translator
        assert sp is not None and translator is not None
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        results: list[str] = [""] * len(texts)
        size = self.background_batch
        for start in range(0, len(order), size):
            # Stand aside while a visitor waits (bounded, so background work is
            # never starved outright). The lock itself is not fair, so a short
            # sleep alone let background batches win it back.
            yield_until = time.monotonic() + BACKGROUND_YIELD_SECONDS
            while self._waiting > 0 and time.monotonic() < yield_until:
                time.sleep(0.05)
            if not self._lock.acquire(timeout=max(1.0, wait_seconds)):
                raise ModelBusy("model is busy")
            try:
                chunk = order[start : start + size]
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

    # ------------------------------------------------ interactive batching

    def _translate_interactive(
        self, texts: list[str], target_token: str, beam_size: int, wait_seconds: float
    ) -> list[str]:
        """Visitors' requests share model batches.

        Every target language is marked by its own <2xx> token, so requests in
        different languages can be decoded together. Requests queue here; the
        first one to get the model runs everything queued at that moment (up to
        max_batch segments with the same beam size) and hands each request its
        results. Twelve visitors asking at once took twelve decodes one after
        another (the last one 64 s, measured); now they take one or two.
        """
        item = _Pending(texts, target_token, beam_size)
        with self._waiting_lock:
            self._waiting += 1
            self._pending.append(item)
        deadline = time.monotonic() + wait_seconds
        try:
            while not item.done.is_set():
                if self._lock.acquire(timeout=0.02):
                    try:
                        self._run_pending()
                    finally:
                        self._lock.release()
                    continue
                if time.monotonic() > deadline:
                    with self._waiting_lock:
                        if not item.started:
                            self._pending.remove(item)
                            raise ModelBusy("model is busy")
                item.done.wait(0.02)
            if item.error is not None:
                raise item.error
            return item.results
        finally:
            with self._waiting_lock:
                self._waiting -= 1

    def _run_pending(self) -> None:
        """With the model lock held: decode queued interactive requests in shared batches."""
        sp = self._sp
        translator = self._translator
        assert sp is not None and translator is not None
        while True:
            with self._waiting_lock:
                if not self._pending:
                    return
                beam = self._pending[0].beam_size
                group: list[_Pending] = []
                segments = 0
                for candidate in list(self._pending):
                    if candidate.beam_size != beam:
                        continue
                    if group and segments + len(candidate.texts) > self.max_batch:
                        break
                    group.append(candidate)
                    segments += len(candidate.texts)
                for candidate in group:
                    self._pending.remove(candidate)
                    candidate.started = True
            try:
                work = [(item, i) for item in group for i in range(len(item.texts))]
                for start in range(0, len(work), self.max_batch):
                    chunk = work[start : start + self.max_batch]
                    batch = [
                        sp.encode(f"<2{item.target_token}> {item.texts[i]}", out_type=str) + ["</s>"]
                        for item, i in chunk
                    ]
                    longest = max(len(tokens) for tokens in batch)
                    output = translator.translate_batch(
                        batch,
                        beam_size=beam,
                        max_decoding_length=min(1024, int(longest * 2.5) + 10),
                        max_input_length=1024,
                        no_repeat_ngram_size=0,
                    )
                    for (item, i), hyp in zip(chunk, output):
                        item.results[i] = sp.decode(hyp.hypotheses[0])
            except Exception as exc:  # noqa: BLE001 - handed to every request in the group
                for item in group:
                    item.error = exc
            for item in group:
                item.done.set()


class _Pending:
    """One interactive request waiting for, or being decoded in, a shared batch."""

    __slots__ = ("texts", "target_token", "beam_size", "results", "done", "started", "error")

    def __init__(self, texts: list[str], target_token: str, beam_size: int) -> None:
        self.texts = texts
        self.target_token = target_token
        self.beam_size = beam_size
        self.results: list[str] = [""] * len(texts)
        self.done = threading.Event()
        self.started = False
        self.error: Exception | None = None
