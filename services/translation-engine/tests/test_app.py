"""HTTP contract tests that need no model: auth, validation, limits, routing."""

import json
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sv_translate.app import create_app
from sv_translate.config import Settings
from sv_translate.engine import Engine

ROUTING = Path(__file__).resolve().parent.parent / "routing.json"
TOKEN = "test-token"


@pytest.fixture()
def client():
    settings = replace(
        Settings(),
        token=TOKEN,
        preload_model=False,
        libretranslate_url=None,
        model_dir=Path("/nonexistent"),
        detector_path=Path("/nonexistent"),
        routing_path=ROUTING,
        max_segments=3,
        max_segment_chars=20,
        max_request_chars=30,
        realtime_wait_seconds=0.01,
        request_timeout_seconds=0.01,
    )
    app = create_app(settings, Engine(settings))
    with TestClient(app) as c:
        yield c


def auth(token=TOKEN):
    return {"Authorization": f"Bearer {token}"}


def body(**kw):
    base = {"source": "en", "target": "hi", "segments": [{"id": "0", "text": "Apply Now"}]}
    base.update(kw)
    return base


def test_refuses_to_start_without_a_token():
    with pytest.raises(RuntimeError):
        create_app(replace(Settings(), token=None, allow_no_token=False, routing_path=ROUTING))


def test_health_is_open_and_ready_reports_not_loaded(client):
    assert client.get("/health").json() == {"ok": True}
    ready = client.get("/ready")
    assert ready.status_code == 503
    assert ready.json()["model"]["ready"] is False


@pytest.mark.parametrize("path", ["/v1/languages", "/metrics"])
def test_reads_require_the_token(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers=auth("wrong")).status_code == 401
    assert client.get(path, headers=auth()).status_code == 200


def test_translate_requires_the_token(client):
    assert client.post("/v1/translate", json=body()).status_code == 401


def test_languages_lists_all_140(client):
    data = client.get("/v1/languages", headers=auth()).json()
    assert len(data["languages"]) == 140
    assert data["retired"] == {"yue": "zh-Hant", "ng": "en", "ku": "ckb", "qu": "es", "ay": "es"}
    ru = next(l for l in data["languages"] if l["code"] == "ru")
    assert ru["plural_categories"] == ["one", "few", "many", "other"]


def test_unsupported_language_is_refused(client):
    response = client.post("/v1/translate", json=body(target="xx"), headers=auth())
    assert response.status_code == 400
    assert response.json()["reason"] == "unsupported_language"
    assert client.post("/v1/translate", json=body(source="klingon"), headers=auth()).status_code == 400


def test_limits(client):
    many = [{"id": str(i), "text": "a"} for i in range(4)]
    assert client.post("/v1/translate", json=body(segments=many), headers=auth()).status_code == 413
    long = [{"id": "0", "text": "x" * 21}]
    assert client.post("/v1/translate", json=body(segments=long), headers=auth()).status_code == 413
    total = [{"id": str(i), "text": "x" * 11} for i in range(3)]
    assert client.post("/v1/translate", json=body(segments=total), headers=auth()).status_code == 413


def test_duplicate_segment_ids_are_refused(client):
    dup = [{"id": "0", "text": "a"}, {"id": "0", "text": "b"}]
    assert client.post("/v1/translate", json=body(segments=dup), headers=auth()).status_code == 422


def test_empty_request_returns_nothing(client):
    response = client.post("/v1/translate", json=body(segments=[]), headers=auth())
    assert response.status_code == 200
    assert response.json()["segments"] == []


def test_same_language_and_non_text_need_no_model(client):
    same = client.post("/v1/translate", json=body(target="en-GB"), headers=auth()).json()
    assert same["segments"][0]["text"] == "Apply Now"
    assert same["segments"][0]["backend"] == "identity"
    numbers = client.post(
        "/v1/translate", json=body(segments=[{"id": "0", "text": "42 {n}"}]), headers=auth()
    ).json()
    assert numbers["segments"][0]["text"] == "42 {n}"


def test_no_backend_means_503_not_a_made_up_answer(client):
    response = client.post("/v1/translate", json=body(), headers=auth())
    assert response.status_code == 503
    assert response.json()["reason"] == "unavailable"


def test_stream_refuses_unsupported_language_before_streaming(client):
    assert client.post("/v1/translate/stream", json=body(target="xx"), headers=auth()).status_code == 400


def test_stream_reports_unavailability_as_an_event(client):
    response = client.post("/v1/translate/stream", json=body(), headers=auth())
    assert response.status_code == 200
    assert "event: error" in response.text


def test_metrics_count_requests(client):
    client.get("/health")
    text = client.get("/metrics", headers=auth()).text
    assert 'svt_requests_total{endpoint="/health",status="200"}' in text


def test_routing_covers_the_registry():
    data = json.loads(ROUTING.read_text(encoding="utf-8"))
    assert len(data["languages"]) == 140
    for code, route in data["languages"].items():
        assert route["madlad"], code
        assert route["direction"] in ("ltr", "rtl")
