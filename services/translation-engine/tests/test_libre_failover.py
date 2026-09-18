"""LibreTranslate is a fallback: when it fails, the model answers, and a
container that keeps failing is taken out of use for a while."""

from dataclasses import replace
from pathlib import Path

import httpx

from sv_translate.backends.libretranslate import LibreTranslateBackend
from sv_translate.config import Settings
from sv_translate.engine import Engine

ROUTING = Path(__file__).resolve().parent.parent / "routing.json"


def backend(handler) -> tuple[LibreTranslateBackend, list]:
    calls: list = []

    def recording(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return handler(request)

    libre = LibreTranslateBackend("http://libre.test")
    libre._client = httpx.Client(transport=httpx.MockTransport(recording))
    return libre, calls


def crashing(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/languages":
        return httpx.Response(200, json=[{"code": "en"}, {"code": "fr"}])
    return httpx.Response(502, text="worker died")


def test_breaker_opens_after_repeated_failures_and_stops_calling():
    libre, calls = backend(crashing)
    assert libre.supports("en", "fr")
    for _ in range(LibreTranslateBackend.FAILURES_TO_OPEN):
        try:
            libre.translate(["Hello"], "en", "fr")
        except Exception:
            pass
    assert libre.open and not libre.ready
    assert not libre.supports("en", "fr")
    before = calls.count("/translate")
    try:
        libre.translate(["Hello"], "en", "fr")
    except RuntimeError as exc:
        assert "circuit is open" in str(exc)
    assert calls.count("/translate") == before  # no call while open


def test_breaker_closes_again_after_the_pause():
    libre, _ = backend(crashing)
    libre._open_until = 1.0  # long past
    assert not libre.open


class BusyModel:
    """A model that is loaded and busy, so the engine tries LibreTranslate first."""

    ready = True
    busy = True
    name = "stub"

    def translate(self, texts, target, beam, wait, interactive=False):
        return [f"[{target}] {t}" for t in texts]

    def version(self):
        return "stub"


def test_a_failing_fallback_hands_the_request_to_the_model():
    settings = replace(
        Settings(),
        token="t",
        preload_model=False,
        libretranslate_url=None,
        model_dir=Path("/nonexistent"),
        detector_path=Path("/nonexistent"),
        routing_path=ROUTING,
    )
    libre, _ = backend(crashing)
    engine = Engine(settings, madlad=BusyModel(), libre=libre)
    outputs, label = engine._run(["Hello"], engine.routes["fr"], engine.routes["en"], "realtime")
    assert label.startswith("madlad")
    assert outputs == ["[fr] Hello"]
