"""Process metrics in the Prometheus text format."""

from __future__ import annotations

import threading
from collections import defaultdict

Labels = tuple[tuple[str, str], ...]


class Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, dict[Labels, float]] = defaultdict(dict)
        self._gauges: dict[str, dict[Labels, float]] = defaultdict(dict)
        self._help: dict[str, tuple[str, str]] = {}

    def describe(self, name: str, kind: str, text: str) -> None:
        self._help[name] = (kind, text)

    def inc(self, name: str, value: float = 1.0, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._counters[name][key] = self._counters[name].get(key, 0.0) + value

    def set(self, name: str, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._gauges[name][key] = value

    def value(self, name: str, **labels: str) -> float:
        key = tuple(sorted(labels.items()))
        with self._lock:
            return self._counters.get(name, {}).get(key, self._gauges.get(name, {}).get(key, 0.0))

    def render(self) -> str:
        lines: list[str] = []
        with self._lock:
            for store in (self._counters, self._gauges):
                for name, series in sorted(store.items()):
                    kind, text = self._help.get(name, ("counter" if store is self._counters else "gauge", name))
                    lines.append(f"# HELP {name} {text}")
                    lines.append(f"# TYPE {name} {kind}")
                    for labels, value in sorted(series.items()):
                        rendered = ",".join(f'{k}="{v}"' for k, v in labels)
                        lines.append(f"{name}{{{rendered}}} {value:g}" if rendered else f"{name} {value:g}")
        return "\n".join(lines) + "\n"


METRICS = Metrics()
METRICS.describe("svt_requests_total", "counter", "HTTP requests by endpoint and status")
METRICS.describe("svt_segments_total", "counter", "Segments translated by backend")
METRICS.describe("svt_cache_total", "counter", "Segment cache lookups by result")
METRICS.describe("svt_backend_seconds_total", "counter", "Seconds spent in each backend")
METRICS.describe("svt_backend_calls_total", "counter", "Backend calls by backend and outcome")
METRICS.describe("svt_low_confidence_total", "counter", "Segments scored below 0.5 by flag")
METRICS.describe("svt_inflight", "gauge", "Translation requests in progress")
METRICS.describe("svt_model_ready", "gauge", "1 when the model is loaded")
