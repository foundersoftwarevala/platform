"""The translation engine: routing, caching, placeholder and plural handling,
backend selection and quality scoring around the local models."""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import unicodedata
from collections import OrderedDict
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from . import icu
from . import text as tx
from .backends.libretranslate import LibreTranslateBackend
from .backends.madlad import MadladBackend, ModelBusy, ModelNotReady
from .config import Settings
from .detect import Detector
from .metrics import METRICS
from .plural import categories_for, sample_number

log = logging.getLogger("sv_translate.engine")


class UnsupportedLanguage(ValueError):
    pass


class EngineUnavailable(RuntimeError):
    pass


class EngineBusy(RuntimeError):
    pass


@dataclass(frozen=True)
class Route:
    code: str
    script: str
    direction: str
    madlad: str
    libretranslate: str | None
    detect: str
    neighbours: tuple[str, ...]
    plural: str | None
    postprocess: tuple[str, ...]


def load_routing(path: Path) -> tuple[dict[str, Route], dict[str, str], str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    routes = {
        code: Route(
            code=code,
            script=entry["script"],
            direction=entry["direction"],
            madlad=entry["madlad"],
            libretranslate=entry.get("libretranslate"),
            detect=entry["detect"],
            neighbours=tuple(entry.get("neighbours", [])),
            plural=entry.get("plural"),
            postprocess=tuple(entry.get("postprocess", [])),
        )
        for code, entry in data["languages"].items()
    }
    return routes, dict(data.get("retired", {})), str(data.get("version", ""))


@dataclass
class SegmentIn:
    id: str
    text: str
    namespace: str = "ui"
    context: str | None = None


@dataclass
class SegmentOut:
    id: str
    text: str
    confidence: float
    backend: str
    flags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "text": self.text,
            "confidence": round(self.confidence, 3),
            "backend": self.backend,
            "flags": self.flags,
        }


@dataclass
class Result:
    text: str
    confidence: float
    backend: str
    flags: list[str]


BASE_CONFIDENCE = {"madlad-beam": 0.85, "madlad-greedy": 0.8, "libretranslate": 0.7, "identity": 1.0}

# fastText labels that name a regional variety in the registry.
DETECT_EXTRA = {"arz": "ar-EG", "yue": "zh-Hant", "nn": None}


class LruCache:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self._data: OrderedDict[tuple, Result] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple) -> Result | None:
        with self._lock:
            value = self._data.get(key)
            if value is not None:
                self._data.move_to_end(key)
            return value

    def put(self, key: tuple, value: Result) -> None:
        if self.capacity <= 0:
            return
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self.capacity:
                self._data.popitem(last=False)

    def __len__(self) -> int:
        return len(self._data)


class Engine:
    def __init__(
        self,
        settings: Settings,
        madlad: MadladBackend | None = None,
        libre: LibreTranslateBackend | None = None,
        detector: Detector | None = None,
    ) -> None:
        self.settings = settings
        self.routes, self.retired, self.routing_version = load_routing(settings.routing_path)
        self._by_lower = {code.lower(): code for code in self.routes}
        self.madlad = madlad or MadladBackend(
            settings.model_dir, settings.intra_threads, settings.max_batch, settings.background_batch
        )
        self.libre = libre
        if self.libre is None and settings.libretranslate_url:
            self.libre = LibreTranslateBackend(settings.libretranslate_url)
        self.detector = detector or Detector(settings.detector_path)
        self.cache = LruCache(settings.cache_entries)
        self._inflight = 0
        self._inflight_lock = threading.Lock()
        self._label_to_code: dict[str, str | None] = {}
        for code, route in self.routes.items():
            if "-" in code and code not in ("zh-Hans", "zh-Hant"):
                continue
            self._label_to_code.setdefault(route.detect, code)
        self._label_to_code.update(DETECT_EXTRA)

    # ------------------------------------------------------------ lifecycle

    def start(self) -> None:
        """Load resources in the background so the service answers health checks at once."""

        def load() -> None:
            self.detector.load()
            self.madlad.load()
            METRICS.set("svt_model_ready", 1.0 if self.madlad.ready else 0.0)

        threading.Thread(target=load, name="model-loader", daemon=True).start()

    def status(self) -> dict:
        libre_ready = bool(self.libre and self.libre.ready)
        return {
            "ready": self.madlad.ready,
            "routing_version": self.routing_version,
            "languages": len(self.routes),
            "model": {
                "name": self.madlad.name,
                "version": self.madlad.version(),
                "ready": self.madlad.ready,
                "busy": self.madlad.busy,
                "load_seconds": self.madlad.load_seconds,
                "error": self.madlad.error,
            },
            "libretranslate": None
            if self.libre is None
            else {"ready": libre_ready, "languages": len(self.libre.languages()), "error": self.libre.error},
            "detector": {"ready": self.detector.ready, "labels": len(self.detector.labels), "error": self.detector.error},
            "cache_entries": len(self.cache),
            "inflight": self._inflight,
        }

    # -------------------------------------------------------------- routing

    def resolve(self, code: str | None) -> Route | None:
        if code is None:
            return None
        canonical = self._by_lower.get(code.strip().lower())
        if canonical is None:
            replacement = self.retired.get(code.strip())
            canonical = self._by_lower.get(replacement.lower()) if replacement else None
        if canonical is None:
            raise UnsupportedLanguage(f"unsupported language: {code}")
        return self.routes[canonical]

    def languages(self) -> list[dict]:
        libre = self.libre.languages() if self.libre else set()
        return [
            {
                "code": r.code,
                "script": r.script,
                "direction": r.direction,
                "backends": ["madlad"] + (["libretranslate"] if r.libretranslate in libre else []),
                "plural_categories": categories_for(r.plural),
                "detectable": r.detect in self.detector.labels if self.detector.ready else None,
            }
            for r in self.routes.values()
        ]

    # ------------------------------------------------------------ detection

    def detect(self, text: str, k: int = 3) -> list[dict]:
        out = []
        for label, prob in self.detector.detect(tx.normalize(text), k=k):
            code = self._label_to_code.get(label)
            if code == "zh-Hans" and _looks_traditional(text):
                code = "zh-Hant"
            out.append({"language": code, "label": label, "confidence": round(prob, 4)})
        return out

    # ---------------------------------------------------------- translation

    def _enter(self) -> None:
        with self._inflight_lock:
            if self._inflight >= self.settings.max_waiting:
                raise EngineBusy("translation queue is full")
            self._inflight += 1
            METRICS.set("svt_inflight", self._inflight)

    def _leave(self) -> None:
        with self._inflight_lock:
            self._inflight -= 1
            METRICS.set("svt_inflight", self._inflight)

    def translate(
        self,
        source: str | None,
        target: str,
        segments: list[SegmentIn],
        glossary: list[tuple[str, str]] | None = None,
        mode: str = "realtime",
    ) -> dict:
        results = list(self.translate_iter(source, target, segments, glossary, mode))
        return {
            "model": self.madlad.name,
            "version": f"{self.madlad.version()}+routing@{self.routing_version}",
            "segments": [r.as_dict() for r in results],
        }

    def translate_iter(
        self,
        source: str | None,
        target: str,
        segments: list[SegmentIn],
        glossary: list[tuple[str, str]] | None = None,
        mode: str = "realtime",
    ) -> Iterator[SegmentOut]:
        route = self.resolve(target)
        assert route is not None
        src = self.resolve(source) if source else None
        preferred = {s: t for s, t in (glossary or []) if s and t}
        glossary_key = tuple(sorted(preferred.items()))
        self._enter()
        try:
            for segment in segments:
                if src is None:
                    detected = self.detect(segment.text, k=1)
                    seg_src = self.resolve(detected[0]["language"]) if detected and detected[0]["language"] else None
                else:
                    seg_src = src
                key = (route.code, seg_src.code if seg_src else "", mode, segment.text, glossary_key)
                cached = self.cache.get(key)
                if cached is not None:
                    METRICS.inc("svt_cache_total", result="hit")
                    yield SegmentOut(segment.id, cached.text, cached.confidence, cached.backend, [*cached.flags, "cache"])
                    continue
                METRICS.inc("svt_cache_total", result="miss")
                result = self._translate_message(segment.text, route, seg_src, preferred, mode)
                if result.confidence < 0.5:
                    for flag in result.flags or ["low"]:
                        METRICS.inc("svt_low_confidence_total", flag=flag.split(":")[0])
                self.cache.put(key, result)
                METRICS.inc("svt_segments_total", backend=result.backend)
                yield SegmentOut(segment.id, result.text, result.confidence, result.backend, list(result.flags))
        finally:
            self._leave()

    def _translate_message(
        self, raw: str, route: Route, src: Route | None, preferred: dict[str, str], mode: str
    ) -> Result:
        text = tx.normalize(raw)
        if src is not None and src.madlad == route.madlad and src.script == route.script:
            return Result(text, 1.0, "identity", ["same_language"])
        if icu.has_complex(text):
            return self._translate_icu(text, route, src, preferred, mode)
        return self._translate_plain(text, route, src, preferred, mode)

    # plain text -------------------------------------------------------------

    def _translate_plain(
        self,
        text: str,
        route: Route,
        src: Route | None,
        preferred: dict[str, str],
        mode: str,
        pound: int | None = None,
    ) -> Result:
        first = self._plain_pass(text, route, src, preferred, mode, literals=False)
        if first is None:
            masked = tx.mask(text, preferred)
            restored, _ = tx.unmask(masked.text, masked.originals)
            return Result(restored, 1.0, "identity", ["nothing_to_translate"])
        restored, backend, flags = first
        # Amounts, currency codes and SKUs are not masked up front (see
        # tx.LITERAL); if the model changed one, the sentence is translated
        # again with them protected.
        lost = tx.lost_literals(text, restored)
        if lost:
            # Only what was changed is masked: every extra token is a chance
            # for the model to drop one and the sentence to be chunked.
            again = self._plain_pass(text, route, src, preferred, mode, literals=lost)
            # The retry can change a value the first pass had kept; then all
            # of them are masked.
            if again is not None and tx.lost_literals(text, again[0]):
                again = self._plain_pass(text, route, src, preferred, mode, literals=True)
            if again is not None:
                restored, backend, flags = again
                flags = [*flags, "literals_protected"]
        confidence, quality_flags = self._score(text, restored, route, src, backend)
        if "chunked" in flags:
            confidence -= 0.1
        return Result(restored, max(0.0, confidence), backend, flags + quality_flags)

    def _plain_pass(
        self,
        text: str,
        route: Route,
        src: Route | None,
        preferred: dict[str, str],
        mode: str,
        literals: bool | list[str],
    ) -> tuple[str, str, list[str]] | None:
        """Mask, translate, restore. None when there is nothing to translate."""
        masked = tx.mask(text, preferred, literals=literals)
        units = tx.segment(masked.text)
        pending = [u.text for u in units if u.translate]
        if not pending:
            return None
        outputs, backend = self._run(pending, route, src, mode)
        it = iter(outputs)
        joined = "".join(next(it) if u.translate else u.text for u in units)
        joined = tx.postprocess(joined, masked.text, list(route.postprocess))
        restored, missing = tx.unmask(joined, masked.originals)
        flags: list[str] = []
        if missing:
            restored, backend = self._translate_chunked(masked, route, src, mode)
            flags.append("chunked")
        return restored, backend, flags

    def _translate_chunked(self, masked: tx.Masked, route: Route, src: Route | None, mode: str) -> tuple[str, str]:
        """Translate the text between placeholders piece by piece, so none can be lost."""
        parts = tx.split_on_tokens(masked.text)
        pieces = [p.strip() for p, is_token in parts if not is_token and tx.needs_translation(p)]
        outputs, backend = self._run(pieces, route, src, mode) if pieces else ([], "identity")
        it = iter(outputs)
        rebuilt: list[str] = []
        for piece, is_token in parts:
            if is_token or not tx.needs_translation(piece):
                rebuilt.append(piece)
                continue
            lead = piece[: len(piece) - len(piece.lstrip())]
            trail = piece[len(piece.rstrip()) :]
            rebuilt.append(lead + tx.postprocess(next(it), piece.strip(), list(route.postprocess)) + trail)
        restored, _ = tx.unmask("".join(rebuilt), masked.originals)
        return restored, backend

    # ICU messages -----------------------------------------------------------

    def _translate_icu(
        self, text: str, route: Route, src: Route | None, preferred: dict[str, str], mode: str
    ) -> Result:
        nodes = icu.parse(text)
        out_nodes, confidence, backend, flags = self._translate_nodes(nodes, route, src, preferred, mode, None)
        return Result(icu.serialize(out_nodes), confidence, backend, sorted(set(flags)))

    def _translate_nodes(
        self,
        nodes: list[icu.Node],
        route: Route,
        src: Route | None,
        preferred: dict[str, str],
        mode: str,
        pound_sample: int | None,
    ) -> tuple[list[icu.Node], float, str, list[str]]:
        blocks: list[icu.Block] = []
        marked: list[str] = []  # the message with every special node as a marker
        for node in nodes:
            if isinstance(node, str):
                marked.append(node)
            elif isinstance(node, icu.Arg):
                marked.append(node.raw)
            elif isinstance(node, icu.Pound):
                marked.append("{__pound}")
            else:
                marked.append(f"{{__block{len(blocks)}}}")
                blocks.append(node)
        marked_text = "".join(marked)
        has_pound = any(isinstance(node, icu.Pound) for node in nodes)
        use_sample = has_pound and pound_sample is not None
        # What the model sees: the number itself where # stands, so the words
        # around it take the right grammatical form.
        model_text = marked_text.replace("{__pound}", str(pound_sample)) if use_sample else marked_text

        confidence = 1.0
        backend = "identity"
        flags: list[str] = []
        translated = marked_text
        if tx.needs_translation(tx.PLACEHOLDER.sub("", model_text)):
            result = self._translate_plain(model_text, route, src, preferred, mode)
            translated, confidence, backend, flags = result.text, result.confidence, result.backend, list(result.flags)
            if use_sample:
                sample = re.escape(str(pound_sample))
                if re.search(rf"(?<!\d){sample}(?!\d)", translated):
                    translated = re.sub(rf"(?<!\d){sample}(?!\d)", "{__pound}", translated, count=1)
                else:
                    # The model wrote the number another way; translate again with # protected.
                    retry = self._translate_nodes(nodes, route, src, preferred, mode, None)
                    out, conf, back, fl = retry
                    return out, conf - 0.1, back, fl + ["plural_sample_lost"]

        out_nodes: list[icu.Node] = []
        for piece in re.split(r"(\{__block\d+\}|\{__pound\})", translated):
            if not piece:
                continue
            match = re.fullmatch(r"\{__block(\d+)\}", piece)
            if match:
                block = blocks[int(match.group(1))]
                new_block, conf, back, fl = self._translate_block(block, route, src, preferred, mode)
                out_nodes.append(new_block)
                confidence = min(confidence, conf)
                backend = back if backend == "identity" else backend
                flags += fl
            elif piece == "{__pound}":
                out_nodes.append(icu.Pound())
            else:
                out_nodes.append(piece)
        missing_blocks = len(blocks) - sum(isinstance(n, icu.Block) for n in out_nodes)
        if missing_blocks:
            flags.append("block_lost")
            confidence = 0.0
        return out_nodes, confidence, backend, flags

    def _translate_block(
        self, block: icu.Block, route: Route, src: Route | None, preferred: dict[str, str], mode: str
    ) -> tuple[icu.Block, float, str, list[str]]:
        new = icu.Block(name=block.name, kind=block.kind, offset=block.offset)
        confidence = 1.0
        backend = "identity"
        flags: list[str] = []
        if block.kind == "plural":
            keys = [k for k in block.options if k.startswith("=")] + categories_for(route.plural)
        else:
            keys = list(block.options)
        for key in keys:
            # `#` shows the value minus the offset; categories are chosen on that
            # same number, while =N matches the value itself.
            if key.startswith("="):
                source_branch = block.options[key]
                exact = int(key[1:]) - block.offset if key[1:].isdigit() else -1
                sample = exact if exact >= 0 else None
            elif block.kind == "plural":
                source_branch = block.options.get(key, block.options["other"])
                sample = sample_number(route.plural, key)
            else:
                source_branch = block.options[key]
                sample = None
            nodes, conf, back, fl = self._translate_nodes(source_branch, route, src, preferred, mode, sample)
            new.options[key] = nodes
            confidence = min(confidence, conf)
            backend = back if backend == "identity" else backend
            flags += fl
        return new, confidence, backend, flags

    # backends -----------------------------------------------------------------

    def _run(self, texts: list[str], route: Route, src: Route | None, mode: str) -> tuple[list[str], str]:
        libre = self.libre
        libre_source = src.libretranslate if src else None
        libre_ok = bool(
            libre
            and route.libretranslate
            and (src is None or libre_source)
            and libre.supports(libre_source, route.libretranslate)
        )
        realtime = mode == "realtime"
        prefer_libre = realtime and libre_ok and (not self.madlad.ready or self.madlad.busy)
        order = ["libretranslate", "madlad"] if prefer_libre else ["madlad", "libretranslate"]
        errors: list[str] = []
        for name in order:
            started = time.monotonic()
            try:
                if name == "madlad":
                    beam = self.settings.realtime_beam_size if realtime else self.settings.beam_size
                    wait = (
                        self.settings.realtime_wait_seconds
                        if realtime and libre_ok
                        else self.settings.request_timeout_seconds
                    )
                    outputs = self.madlad.translate(
                        texts, route.madlad, beam, wait, interactive=realtime
                    )
                    label = "madlad-greedy" if beam == 1 else "madlad-beam"
                else:
                    if not libre_ok:
                        continue
                    assert libre is not None and route.libretranslate is not None
                    outputs = libre.translate(texts, libre_source, route.libretranslate)
                    label = "libretranslate"
                METRICS.inc("svt_backend_calls_total", backend=name, outcome="ok")
                METRICS.inc("svt_backend_seconds_total", time.monotonic() - started, backend=name)
                return outputs, label
            except (ModelBusy, ModelNotReady) as exc:
                METRICS.inc("svt_backend_calls_total", backend=name, outcome="unavailable")
                errors.append(f"{name}: {exc}")
            except Exception as exc:  # noqa: BLE001 - the next backend is tried
                METRICS.inc("svt_backend_calls_total", backend=name, outcome="error")
                log.warning("backend failed", extra={"backend": name, "error": str(exc)})
                errors.append(f"{name}: {type(exc).__name__}")
        raise EngineUnavailable("; ".join(errors) or "no backend available")

    # quality ------------------------------------------------------------------

    def _score(self, source: str, output: str, route: Route, src: Route | None, backend: str) -> tuple[float, list[str]]:
        confidence = BASE_CONFIDENCE.get(backend, 0.7)
        flags: list[str] = []
        plain_source = tx.PLACEHOLDER.sub("", source)
        plain_output = tx.PLACEHOLDER.sub("", output)
        if not output.strip():
            return 0.0, ["empty"]
        letters = sum(1 for ch in plain_source if unicodedata.category(ch).startswith("L"))
        share = tx.script_share(plain_output, route.script)
        if share is not None and letters >= 3 and share < 0.5:
            confidence -= 0.5
            flags.append("wrong_script")
        # Language identification is only trusted to catch the failure it can
        # catch: the model answering in English (not translated at all) or in
        # the language this one falls back to (e.g. Spanish for Guarani).
        # Identification is unreliable for languages close to a high-resource
        # neighbour, so anything else it reports is not held against the
        # translation. routing.json lists the neighbours per language.
        #
        # The identifier's verdict alone is not evidence. It calls short text
        # in a language close to English English ("Jou bestelling is bevestig",
        # correct Afrikaans, came back en 0.77), and it calls a language it has
        # no label for (Bambara) whatever is nearest. So an "English" verdict
        # counts only when the answer reuses the English source's words, which
        # is what an untranslated answer looks like, and a neighbour verdict
        # counts only when the identifier could have recognised the target.
        suspects = {"en", *route.neighbours} - {route.detect}
        if self.detector.ready and suspects and len(plain_output.strip()) >= 25:
            top = self.detector.detect(plain_output, k=3)
            labels = [label for label, _ in top]
            if top and top[0][0] in suspects and top[0][1] >= 0.7 and route.detect not in labels:
                if top[0][0] == "en":
                    evidence = tx.word_overlap(plain_source, plain_output) >= 0.5
                else:
                    evidence = route.detect in self.detector.labels
                if evidence:
                    confidence -= 0.4
                    flags.append(f"wrong_language:{top[0][0]}")
        if tx.repetition_ratio(plain_output) > 0.3:
            confidence -= 0.3
            flags.append("repetition")
        same_language = src is not None and src.madlad == route.madlad
        if not same_language and output.strip() == source.strip() and len(plain_source.split()) >= 3:
            confidence -= 0.3
            flags.append("untranslated")
        if len(plain_source.strip()) >= 12:
            ratio = len(plain_output.strip()) / max(1, len(plain_source.strip()))
            if ratio > 4 or ratio < 0.25:
                confidence -= 0.2
                flags.append("length_ratio")
        return max(0.0, min(1.0, confidence)), flags


def _looks_traditional(text: str) -> bool:
    """True when the text uses characters found only in Traditional Chinese."""
    traditional = set("們這個會來為說時國學對與樣還從開關點裡後麼體發問經過當進種現實頭應");
    simplified = set("们这个会来为说时国学对与样还从开关点里后么体发问经过当进种现实头应")
    t = sum(ch in traditional for ch in text)
    s = sum(ch in simplified for ch in text)
    return t > s
