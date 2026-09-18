"""HTTP interface of the Software Vala translation engine.

POST /v1/translate          translate segments (the contract the application's
                            owned-engine provider speaks)
POST /v1/translate/stream   the same, as server-sent events, one per segment
POST /v1/detect             identify the language of a text
GET  /v1/languages          supported languages, backends and plural categories
GET  /health                process is up
GET  /ready                 model loaded and able to translate
GET  /metrics               Prometheus metrics
"""

from __future__ import annotations

import hmac
import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import iterate_in_threadpool, run_in_threadpool

from .config import Settings, load_settings
from .engine import Engine, EngineBusy, EngineUnavailable, SegmentIn, UnsupportedLanguage
from .metrics import METRICS


class JsonFormatter(logging.Formatter):
    RESERVED = set(vars(logging.makeLogRecord({})))

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": round(record.created, 3),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        payload.update({k: v for k, v in vars(record).items() if k not in self.RESERVED and k != "message"})
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def _configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


class SegmentModel(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    text: str
    namespace: str = Field(default="ui", max_length=48)
    context: str | None = Field(default=None, max_length=500)


class GlossaryModel(BaseModel):
    source: str = Field(min_length=1, max_length=200)
    target: str = Field(min_length=1, max_length=200)


class TranslateRequest(BaseModel):
    source: str | None = Field(default=None, max_length=32)
    target: str = Field(min_length=2, max_length=32)
    target_script: str | None = None
    target_direction: str | None = None
    segments: list[SegmentModel]
    glossary: list[GlossaryModel] = Field(default_factory=list, max_length=200)
    mode: Literal["realtime", "quality"] = "realtime"

    @field_validator("segments")
    @classmethod
    def unique_ids(cls, value: list[SegmentModel]) -> list[SegmentModel]:
        if len({s.id for s in value}) != len(value):
            raise ValueError("segment ids must be unique")
        return value


class DetectRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    k: int = Field(default=3, ge=1, le=10)


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    settings = settings or load_settings()
    if not settings.token and not settings.allow_no_token:
        raise RuntimeError("SVT_TOKEN is required (or set SVT_ALLOW_NO_TOKEN=1 for local development)")
    engine = engine or Engine(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        _configure_logging()
        if settings.preload_model:
            engine.start()
        yield

    app = FastAPI(
        title="Software Vala translation engine",
        version="1.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )

    def authorize(request: Request) -> None:
        if not settings.token:
            return
        header = request.headers.get("authorization", "")
        supplied = header[7:] if header.startswith("Bearer ") else ""
        if not hmac.compare_digest(supplied.encode(), settings.token.encode()):
            raise HTTPException(status_code=401, detail="unauthorized")

    def check_size(body: TranslateRequest) -> list[SegmentIn]:
        if not body.segments:
            return []
        if len(body.segments) > settings.max_segments:
            raise HTTPException(status_code=413, detail="too many segments")
        total = 0
        for segment in body.segments:
            if len(segment.text) > settings.max_segment_chars:
                raise HTTPException(status_code=413, detail=f"segment {segment.id} is too long")
            total += len(segment.text)
        if total > settings.max_request_chars:
            raise HTTPException(status_code=413, detail="too much text")
        return [SegmentIn(s.id, s.text, s.namespace, s.context) for s in body.segments]

    @app.middleware("http")
    async def count_requests(request: Request, call_next):
        started = time.monotonic()
        response = await call_next(request)
        METRICS.inc("svt_requests_total", endpoint=request.url.path, status=str(response.status_code))
        logging.getLogger("sv_translate.http").info(
            "request",
            extra={
                "path": request.url.path,
                "status": response.status_code,
                "ms": round((time.monotonic() - started) * 1000),
            },
        )
        return response

    @app.exception_handler(UnsupportedLanguage)
    async def _unsupported(_: Request, exc: UnsupportedLanguage):
        return JSONResponse({"error": str(exc), "reason": "unsupported_language"}, status_code=400)

    @app.exception_handler(EngineBusy)
    async def _busy(_: Request, exc: EngineBusy):
        return JSONResponse({"error": str(exc), "reason": "busy"}, status_code=503, headers={"Retry-After": "5"})

    @app.exception_handler(EngineUnavailable)
    async def _unavailable(_: Request, exc: EngineUnavailable):
        logging.getLogger("sv_translate.http").warning("engine unavailable", extra={"error": str(exc)})
        return JSONResponse({"error": "no translation backend is available", "reason": "unavailable"}, status_code=503)

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/ready")
    def ready():
        status = engine.status()
        return JSONResponse(status, status_code=200 if status["ready"] else 503)

    @app.get("/metrics", dependencies=[Depends(authorize)])
    def metrics() -> PlainTextResponse:
        return PlainTextResponse(METRICS.render(), media_type="text/plain; version=0.0.4")

    @app.get("/v1/languages", dependencies=[Depends(authorize)])
    def languages() -> dict:
        return {"languages": engine.languages(), "retired": engine.retired}

    @app.post("/v1/detect", dependencies=[Depends(authorize)])
    async def detect(body: DetectRequest) -> dict:
        return {"candidates": await run_in_threadpool(engine.detect, body.text, body.k)}

    @app.post("/v1/translate", dependencies=[Depends(authorize)])
    async def translate(body: TranslateRequest) -> dict:
        segments = check_size(body)
        glossary = [(g.source, g.target) for g in body.glossary]
        return await run_in_threadpool(engine.translate, body.source, body.target, segments, glossary, body.mode)

    @app.post("/v1/translate/stream", dependencies=[Depends(authorize)])
    async def translate_stream(body: TranslateRequest) -> StreamingResponse:
        segments = check_size(body)
        glossary = [(g.source, g.target) for g in body.glossary]
        engine.resolve(body.target)  # refuse an unsupported language before streaming starts
        if body.source:
            engine.resolve(body.source)

        def events():
            try:
                for result in engine.translate_iter(body.source, body.target, segments, glossary, body.mode):
                    yield f"event: segment\ndata: {json.dumps(result.as_dict(), ensure_ascii=False)}\n\n"
                yield "event: done\ndata: {}\n\n"
            except (EngineBusy, EngineUnavailable) as exc:
                yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

        return StreamingResponse(
            iterate_in_threadpool(events()),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    app.state.engine = engine
    return app
