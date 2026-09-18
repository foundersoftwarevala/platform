"""The engine's quality score, with the language identifier replaced by a stub
that returns the verdicts the real identifier (lid.176) gave on the host."""

from dataclasses import replace
from pathlib import Path

from sv_translate import text as tx
from sv_translate.config import Settings
from sv_translate.engine import Engine

ROUTING = Path(__file__).resolve().parent.parent / "routing.json"


class StubDetector:
    def __init__(self, verdict, labels):
        self.verdict = verdict
        self.labels = set(labels)
        self.ready = True

    def detect(self, text, k=3):
        return self.verdict[:k]


def engine_with(verdict, labels):
    settings = replace(
        Settings(),
        token="t",
        preload_model=False,
        libretranslate_url=None,
        model_dir=Path("/nonexistent"),
        detector_path=Path("/nonexistent"),
        routing_path=ROUTING,
    )
    engine = Engine(settings)
    engine.detector = StubDetector(verdict, labels)
    return engine


SOURCE = "Your order has been confirmed."


def test_correct_afrikaans_is_not_called_english():
    # lid.176 on this sentence: en 0.7656, nl 0.063, de 0.0292.
    engine = engine_with([("en", 0.7656), ("nl", 0.063), ("de", 0.0292)], {"en", "nl", "de", "af"})
    confidence, flags = engine._score(SOURCE, "Jou bestelling is bevestig.", engine.routes["af"], None, "madlad-greedy")
    assert not any(f.startswith("wrong_language") for f in flags), flags
    assert confidence >= 0.5


def test_a_language_the_identifier_has_no_label_for_is_not_called_english():
    # lid.176 has no Bambara label; it answered en 0.856.
    engine = engine_with([("en", 0.856), ("es", 0.0546), ("it", 0.0444)], {"en", "es", "it"})
    confidence, flags = engine._score(SOURCE, "Woro koun yamaruyalen do ka ɲɛ.", engine.routes["bm"], None, "madlad-greedy")
    assert not any(f.startswith("wrong_language") for f in flags), flags
    assert confidence >= 0.5


def test_an_answer_in_english_is_still_caught():
    engine = engine_with([("en", 0.97), ("nl", 0.01), ("de", 0.01)], {"en", "nl", "de", "af"})
    confidence, flags = engine._score(
        SOURCE, "Your order has now been confirmed today.", engine.routes["af"], None, "madlad-greedy"
    )
    assert "wrong_language:en" in flags
    assert confidence < 0.5


def test_word_overlap():
    assert tx.word_overlap(SOURCE, "Your order has been confirmed") == 1.0
    assert tx.word_overlap(SOURCE, "Jou bestelling is bevestig") == 0.0
    assert tx.word_overlap(SOURCE, "") == 0.0
