"""Tests against the real models. Run with SVT_LIVE=1 inside the service image
with the models mounted (see deploy/deploy.sh). They translate real text; no
result is scripted.

SVT_LIVE_REPORT=<path> also writes the per-language verification report.
"""

import json
import os
import time
from dataclasses import replace
from pathlib import Path

import pytest

from sv_translate import icu
from sv_translate.config import Settings
from sv_translate.engine import Engine, SegmentIn
from sv_translate.plural import categories_for

pytestmark = pytest.mark.skipif(os.environ.get("SVT_LIVE") != "1", reason="set SVT_LIVE=1 to run against the models")

SAMPLE = "Your order has been confirmed."


@pytest.fixture(scope="module")
def engine():
    settings = replace(Settings(), realtime_wait_seconds=600, request_timeout_seconds=600)
    e = Engine(settings)
    e.detector.load()
    e.madlad.load()
    assert e.madlad.ready, e.madlad.error
    return e


def one(engine, target, text, mode="quality", source="en", glossary=None):
    out = engine.translate(source, target, [SegmentIn("0", text)], glossary, mode)
    return out["segments"][0]


def test_placeholders_survive(engine):
    seg = one(engine, "es", "Hello {name}, you have %s new messages in <b>Vala TV</b>.")
    for token in ("{name}", "%s", "<b>", "</b>"):
        assert token in seg["text"], seg
    assert seg["confidence"] >= 0.5, seg


def test_plural_message_gets_the_target_categories(engine):
    message = "You have {count, plural, one {# item} other {# items}} in your cart."
    seg = one(engine, "ru", message)
    nodes = icu.parse(seg["text"])
    block = next(n for n in nodes if isinstance(n, icu.Block))
    assert list(block.options) == ["one", "few", "many", "other"], seg
    assert all(any(isinstance(x, icu.Pound) for x in branch) for branch in block.options.values()), seg
    ja = icu.parse(one(engine, "ja", message)["text"])
    assert list(next(n for n in ja if isinstance(n, icu.Block)).options) == ["other"]


def test_preferred_term_is_used(engine):
    seg = one(engine, "fr", "Open the checkout page.", glossary=[("checkout", "caisse Vala")])
    assert "caisse Vala" in seg["text"], seg


def test_detection(engine):
    assert engine.detect("Ceci est une phrase écrite en français pour le test.")[0]["language"] == "fr"
    assert engine.detect("यह परीक्षण के लिए हिंदी में लिखा गया वाक्य है।")[0]["language"] == "hi"


def test_unknown_source_is_detected(engine):
    seg = one(engine, "en", "Ceci est une phrase écrite en français.", source=None)
    assert seg["backend"].startswith(("madlad", "libretranslate")), seg
    assert "French" not in seg["text"]


def test_realtime_falls_back_to_libretranslate_when_model_is_busy(engine):
    if engine.libre is None or not engine.libre.ready:
        pytest.skip("LibreTranslate is not configured")
    engine.madlad._lock.acquire()
    try:
        fast = replace(engine.settings, realtime_wait_seconds=0.05)
        engine.settings = fast
        seg = one(engine, "de", "The weather is nice today.", mode="realtime")
        assert seg["backend"] == "libretranslate", seg
    finally:
        engine.madlad._lock.release()


def test_every_language(engine):
    """Translate a real sentence into each of the 140 languages and check it."""
    report = []
    failures = []
    for code, route in engine.routes.items():
        started = time.monotonic()
        seg = one(engine, code, SAMPLE)
        seconds = round(time.monotonic() - started, 2)
        same = route.madlad == "en"
        ok = seg["text"].strip() != "" and (same or seg["confidence"] >= 0.5)
        entry = {
            "code": code,
            "ok": ok,
            "text": seg["text"],
            "confidence": seg["confidence"],
            "backend": seg["backend"],
            "flags": seg["flags"],
            "seconds": seconds,
            "plural_categories": categories_for(route.plural),
            "detected": engine.detect(seg["text"], k=1)[0]["label"] if not same and engine.detector.ready else None,
        }
        report.append(entry)
        if not ok:
            failures.append(entry)
    path = os.environ.get("SVT_LIVE_REPORT")
    if path:
        Path(path).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    assert len(report) == 140
    assert not failures, failures
