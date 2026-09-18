"""Service configuration, read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int) -> int:
    value = os.environ.get(name)
    return int(value) if value and value.strip() else default


def _float(name: str, default: float) -> float:
    value = os.environ.get(name)
    return float(value) if value and value.strip() else default


@dataclass(frozen=True)
class Settings:
    # MADLAD-400 3B, CTranslate2 int8 (Apache-2.0).
    model_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("SVT_MODEL_DIR", "/models/madlad400-3b-mt-ct2-int8"))
    )
    # fastText language identification, lid.176 (CC-BY-SA-3.0).
    detector_path: Path = field(
        default_factory=lambda: Path(os.environ.get("SVT_DETECTOR_PATH", "/models/lid.176.ftz"))
    )
    routing_path: Path = field(
        default_factory=lambda: Path(
            os.environ.get("SVT_ROUTING_PATH", str(Path(__file__).resolve().parent.parent / "routing.json"))
        )
    )
    # Self-hosted LibreTranslate (Argos models). Optional second backend.
    libretranslate_url: str | None = field(default_factory=lambda: os.environ.get("SVT_LIBRETRANSLATE_URL") or None)
    # Bearer token callers must present. Required unless SVT_ALLOW_NO_TOKEN=1.
    token: str | None = field(default_factory=lambda: os.environ.get("SVT_TOKEN") or None)
    allow_no_token: bool = field(default_factory=lambda: os.environ.get("SVT_ALLOW_NO_TOKEN") == "1")

    intra_threads: int = field(default_factory=lambda: _int("SVT_INTRA_THREADS", 2))
    beam_size: int = field(default_factory=lambda: _int("SVT_BEAM_SIZE", 2))
    realtime_beam_size: int = field(default_factory=lambda: _int("SVT_REALTIME_BEAM_SIZE", 1))
    max_batch: int = field(default_factory=lambda: _int("SVT_MAX_BATCH", 8))
    # Segments per model batch for background (quality) work; small, so an
    # interactive request never waits long behind it.
    background_batch: int = field(default_factory=lambda: _int("SVT_BACKGROUND_BATCH", 2))

    max_segments: int = field(default_factory=lambda: _int("SVT_MAX_SEGMENTS", 100))
    max_segment_chars: int = field(default_factory=lambda: _int("SVT_MAX_SEGMENT_CHARS", 5000))
    max_request_chars: int = field(default_factory=lambda: _int("SVT_MAX_REQUEST_CHARS", 50000))
    # Requests waiting for the model beyond this are refused with 503.
    max_waiting: int = field(default_factory=lambda: _int("SVT_MAX_WAITING", 32))
    # A realtime request uses LibreTranslate instead of waiting this long.
    realtime_wait_seconds: float = field(default_factory=lambda: _float("SVT_REALTIME_WAIT_SECONDS", 20.0))
    request_timeout_seconds: float = field(default_factory=lambda: _float("SVT_REQUEST_TIMEOUT_SECONDS", 180.0))

    cache_entries: int = field(default_factory=lambda: _int("SVT_CACHE_ENTRIES", 50000))
    preload_model: bool = field(default_factory=lambda: os.environ.get("SVT_PRELOAD", "1") == "1")


def load_settings() -> Settings:
    return Settings()
