"""How the model is shared between visitors and background work, with a stub
in place of CTranslate2 (no model needed)."""

import threading
import time
from pathlib import Path

from sv_translate.backends import madlad as madlad_module
from sv_translate.backends.madlad import MadladBackend


class StubSp:
    def encode(self, text, out_type=str):
        return text.split()

    def decode(self, tokens):
        return " ".join(tokens)


class StubHyp:
    def __init__(self, tokens):
        self.hypotheses = [tokens]


class StubTranslator:
    def __init__(self, seconds_per_batch=0.0):
        self.batches = []
        self.seconds = seconds_per_batch
        self.log = []

    def translate_batch(self, batch, **kwargs):
        self.batches.append(len(batch))
        self.log.append(("start", batch[0][1] if len(batch[0]) > 1 else ""))
        time.sleep(self.seconds)
        return [StubHyp(tokens[1:-1]) for tokens in batch]


def backend(translator, max_batch=8, background_batch=2):
    b = MadladBackend(Path("/nonexistent"), 1, max_batch, background_batch)
    b._translator = translator
    b._sp = StubSp()
    b._ready.set()
    return b


def test_background_work_uses_small_batches_and_interactive_full_ones():
    stub = StubTranslator()
    b = backend(stub)
    b.translate([f"text {i}" for i in range(8)], "hi", 2, 10, interactive=False)
    assert stub.batches == [2, 2, 2, 2]
    stub.batches.clear()
    b.translate([f"text {i}" for i in range(8)], "hi", 1, 10, interactive=True)
    assert stub.batches == [8]


def test_background_stands_aside_while_a_visitor_waits(monkeypatch):
    monkeypatch.setattr(madlad_module, "BACKGROUND_YIELD_SECONDS", 5.0)
    stub = StubTranslator(seconds_per_batch=0.2)
    b = backend(stub)
    order = []

    def background():
        b.translate([f"bg{i}" for i in range(6)], "hi", 2, 10, interactive=False)
        order.append("background done")

    def visitor():
        b.translate(["visitor"], "hi", 1, 10, interactive=True)
        order.append("visitor done")

    worker = threading.Thread(target=background)
    worker.start()
    time.sleep(0.05)  # background holds the model for its first batch
    visitor_thread = threading.Thread(target=visitor)
    visitor_thread.start()
    visitor_thread.join(5)
    worker.join(10)
    # The visitor is served after at most the one background batch in progress.
    assert order == ["visitor done", "background done"]
    started = [entry[1] for entry in stub.log]
    assert started.index("visitor") <= 1


def test_background_is_not_starved_forever(monkeypatch):
    monkeypatch.setattr(madlad_module, "BACKGROUND_YIELD_SECONDS", 0.2)
    stub = StubTranslator()
    b = backend(stub)
    b._waiting = 1  # a visitor that never finishes
    t0 = time.monotonic()
    out = b.translate(["a b", "c d"], "hi", 2, 10, interactive=False)
    assert out == ["a b", "c d"]
    assert time.monotonic() - t0 < 2


class EchoTargetTranslator(StubTranslator):
    """Answers with the target token kept, so each result shows which language it was for."""

    def translate_batch(self, batch, **kwargs):
        self.batches.append(len(batch))
        return [StubHyp(tokens[:-1]) for tokens in batch]


def test_visitors_in_different_languages_share_one_batch():
    stub = EchoTargetTranslator()
    b = backend(stub)
    b._lock.acquire()  # the model is busy when they arrive
    results = {}

    def visitor(lang):
        results[lang] = b.translate([f"hello {lang}"], lang, 1, 10, interactive=True)

    threads = [threading.Thread(target=visitor, args=(lang,)) for lang in ("hi", "dv", "sd", "ug", "mr", "ta")]
    for t in threads:
        t.start()
    for _ in range(200):
        if len(b._pending) == 6:
            break
        time.sleep(0.01)
    assert len(b._pending) == 6
    b._lock.release()
    for t in threads:
        t.join(5)
    assert stub.batches == [6]
    for lang, out in results.items():
        assert out == [f"<2{lang}> hello {lang}"]


def test_a_visitor_that_cannot_get_the_model_in_time_is_told_so():
    stub = StubTranslator()
    b = backend(stub)
    b._lock.acquire()
    try:
        started = time.monotonic()
        try:
            b.translate(["late"], "hi", 1, 0.3, interactive=True)
            raised = False
        except madlad_module.ModelBusy:
            raised = True
        assert raised and time.monotonic() - started < 2
        assert b._pending == [] and b._waiting == 0
    finally:
        b._lock.release()
