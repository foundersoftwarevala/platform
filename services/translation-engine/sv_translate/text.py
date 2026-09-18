"""Text handling around the model: normalisation, segmentation, placeholder
protection, script checks and language-specific post-processing.

Nothing here translates. It prepares text so a model sees clean sentences
without placeholders it could damage, and checks what comes back.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Tokens the model must return untouched. The pipeline in the application
# protects glossary terms as ⟦T0⟧; everything else that looks like code
# (ICU/format placeholders, printf, HTML tags, URLs, e-mail addresses) is
# protected here as ⟦P0⟧.
PLACEHOLDER = re.compile(
    r"⟦[TP]\d+⟧"
    r"|\{\{\s*[\w.]+\s*\}\}"
    r"|\{[\w.]+(?:,[^{}]*)?\}"
    r"|%(?:\d+\$)?[sdif@]"
    r"|</?[a-zA-Z][^<>]*>"
    r"|https?://[^\s<>\"']*[^\s<>\"'.,;:!?)\]}。、]"
    r"|[\w.+-]+@[\w-]+\.[\w.-]+"
)

TOKEN = re.compile(r"⟦P(\d+)⟧")

# Sentence ends, including Devanagari, Arabic, CJK and Ethiopic punctuation.
SENTENCE_END = re.compile(r"(?<=[.!?。！？।॥؟።])\s+")

LONG_LINE = 400


def normalize(text: str) -> str:
    """NFC, unified newlines, no stray control characters."""
    text = unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n")
    return "".join(ch for ch in text if ch in "\n\t" or unicodedata.category(ch) != "Cc")


@dataclass
class Masked:
    text: str
    originals: list[str]


def mask(text: str, preferred: dict[str, str] | None = None) -> Masked:
    """Replace placeholders (and preferred glossary terms) with ⟦Pn⟧ tokens.

    `preferred` maps a source term to the rendering the translation must use;
    the term is protected like a placeholder and restored as its rendering.
    """
    originals: list[str] = []

    def keep(value: str) -> str:
        originals.append(value)
        return f"⟦P{len(originals) - 1}⟧"

    out = PLACEHOLDER.sub(lambda m: keep(m.group(0)), text)
    for source, target in sorted((preferred or {}).items(), key=lambda kv: -len(kv[0])):
        pattern = re.compile(rf"(?<![\w]){re.escape(source)}(?![\w])", re.IGNORECASE)
        out = pattern.sub(lambda m, t=target: keep(t), out)
    return Masked(out, originals)


def unmask(text: str, originals: list[str]) -> tuple[str, list[int]]:
    """Put protected values back. Returns the text and the indexes that were lost."""
    seen: set[int] = set()

    def restore(m: re.Match[str]) -> str:
        index = int(m.group(1))
        if index >= len(originals):
            return ""
        seen.add(index)
        return originals[index]

    # Models sometimes add spaces inside the brackets; accept those too.
    text = re.sub(r"⟦\s*P\s*(\d+)\s*⟧", lambda m: f"⟦P{m.group(1)}⟧", text)
    restored = TOKEN.sub(restore, text)
    missing = [i for i in range(len(originals)) if i not in seen]
    return restored, missing


def split_on_tokens(text: str) -> list[tuple[str, bool]]:
    """Split masked text into (piece, is_token) runs."""
    parts: list[tuple[str, bool]] = []
    last = 0
    for m in TOKEN.finditer(text):
        if m.start() > last:
            parts.append((text[last : m.start()], False))
        parts.append((m.group(0), True))
        last = m.end()
    if last < len(text):
        parts.append((text[last:], False))
    return parts


@dataclass
class Unit:
    """A piece of text: translated if `translate`, copied otherwise."""

    text: str
    translate: bool


def segment(text: str) -> list[Unit]:
    """Lines and, for long lines, sentences. Whitespace is kept as-is."""
    units: list[Unit] = []
    for index, line in enumerate(text.split("\n")):
        if index:
            units.append(Unit("\n", False))
        lead = line[: len(line) - len(line.lstrip())]
        trail = line[len(line.rstrip()) :]
        core = line.strip()
        if lead:
            units.append(Unit(lead, False))
        if core:
            if needs_translation(core):
                pieces = SENTENCE_END.split(core) if len(core) > LONG_LINE else [core]
                for i, piece in enumerate(pieces):
                    if i:
                        units.append(Unit(" ", False))
                    units.append(Unit(piece, True))
            else:
                units.append(Unit(core, False))
        if trail:
            units.append(Unit(trail, False))
    return units


def needs_translation(text: str) -> bool:
    """False for text with no letters outside placeholders (numbers, symbols, tokens)."""
    stripped = TOKEN.sub("", text)
    return any(unicodedata.category(ch).startswith("L") for ch in stripped)


# --------------------------------------------------------------- scripts

_SCRIPT_NAMES = {
    "Latn": ("LATIN",),
    "Cyrl": ("CYRILLIC",),
    "Grek": ("GREEK",),
    "Arab": ("ARABIC",),
    "Hebr": ("HEBREW",),
    "Deva": ("DEVANAGARI",),
    "Beng": ("BENGALI",),
    "Guru": ("GURMUKHI",),
    "Gujr": ("GUJARATI",),
    "Orya": ("ORIYA",),
    "Taml": ("TAMIL",),
    "Telu": ("TELUGU",),
    "Knda": ("KANNADA",),
    "Mlym": ("MALAYALAM",),
    "Sinh": ("SINHALA",),
    "Thai": ("THAI",),
    "Laoo": ("LAO",),
    "Khmr": ("KHMER",),
    "Mymr": ("MYANMAR",),
    "Hans": ("CJK",),
    "Hant": ("CJK",),
    "Jpan": ("CJK", "HIRAGANA", "KATAKANA"),
    "Kore": ("HANGUL",),
    "Armn": ("ARMENIAN",),
    "Geor": ("GEORGIAN",),
    "Ethi": ("ETHIOPIC",),
    "Thaa": ("THAANA",),
}


def script_share(text: str, script: str) -> float | None:
    """Share of letters written in `script`, or None when there are no letters."""
    prefixes = _SCRIPT_NAMES.get(script)
    letters = [ch for ch in TOKEN.sub("", text) if unicodedata.category(ch).startswith("L")]
    if not letters or not prefixes:
        return None
    hits = 0
    for ch in letters:
        name = unicodedata.name(ch, "")
        if name.startswith(prefixes):
            hits += 1
    return hits / len(letters)


# ---------------------------------------------------------- post-process

_SR_LATIN_TO_CYRILLIC = [
    ("Dž", "Џ"), ("DŽ", "Џ"), ("dž", "џ"), ("Lj", "Љ"), ("LJ", "Љ"), ("lj", "љ"),
    ("Nj", "Њ"), ("NJ", "Њ"), ("nj", "њ"),
]
_SR_SINGLE = str.maketrans(
    "ABVGDĐEŽZIJKLMNOPRSTĆUFHCČŠabvgdđežzijklmnoprstćufhcčš",
    "АБВГДЂЕЖЗИЈКЛМНОПРСТЋУФХЦЧШабвгдђежзијклмнопрстћуфхцчш",
)


def serbian_to_cyrillic(text: str) -> str:
    """Serbian Latin to Cyrillic. The two alphabets map one to one; placeholders are left alone."""

    def convert(piece: str) -> str:
        for latin, cyrillic in _SR_LATIN_TO_CYRILLIC:
            piece = piece.replace(latin, cyrillic)
        return piece.translate(_SR_SINGLE)

    return "".join(p if is_token else convert(p) for p, is_token in split_on_tokens(text))


_UZ_MULTI = [
    ("Ё", "Yo"), ("ё", "yo"), ("Ю", "Yu"), ("ю", "yu"), ("Я", "Ya"), ("я", "ya"),
    ("Ч", "Ch"), ("ч", "ch"), ("Ш", "Sh"), ("ш", "sh"), ("Щ", "Shch"), ("щ", "shch"),
    ("Ц", "Ts"), ("ц", "ts"), ("Ғ", "Gʻ"), ("ғ", "gʻ"), ("Ў", "Oʻ"), ("ў", "oʻ"),
    ("Ъ", "ʼ"), ("ъ", "ʼ"), ("Ь", ""), ("ь", ""), ("Э", "E"), ("э", "e"),
]
_UZ_SINGLE = str.maketrans(
    "АБВГДЕЖЗИЙКЛМНОПРСТУФХҲҚабвгдежзийклмнопрстуфхҳқ",
    "ABVGDEJZIYKLMNOPRSTUFXHQabvgdejziyklmnoprstufxhq",
)


def uzbek_to_latin(text: str) -> str:
    """Uzbek Cyrillic to the official Latin alphabet. Placeholders are left alone."""

    def convert(piece: str) -> str:
        for cyrillic, latin in _UZ_MULTI:
            piece = piece.replace(cyrillic, latin)
        return piece.translate(_UZ_SINGLE)

    return "".join(p if is_token else convert(p) for p, is_token in split_on_tokens(text))


# A capitalised Latin word stuck directly onto the end of non-Latin text:
# "ארנק דיגיטליName". MADLAD appends "Name" to short Hebrew labels, a trace of
# the software-localisation files it was trained on, where a field label is
# followed by its key.
_GLUED_LATIN_TAIL = re.compile(r"(?<=[^\x00-\x7F])([A-Z][a-z]{2,})$")


def strip_glued_latin_tail(text: str, source: str) -> str:
    """Remove a Latin word glued onto the end of non-Latin text when the source never had it."""
    match = _GLUED_LATIN_TAIL.search(text)
    if match and match.group(1) not in source:
        return text[: match.start()].rstrip()
    return text


_OPENCC = None


def to_traditional_chinese(text: str) -> str:
    """Simplified characters in Traditional Chinese output converted with OpenCC (s2t).

    The model's zh_Hant output is Traditional but lets Simplified characters
    through ("成為供应商" for 成為供應商). Placeholders are left alone.
    """
    global _OPENCC
    if _OPENCC is None:
        from opencc import OpenCC  # opencc-python-reimplemented, Apache-2.0

        _OPENCC = OpenCC("s2t")
    return "".join(p if is_token else _OPENCC.convert(p) for p, is_token in split_on_tokens(text))


def postprocess(text: str, source: str, rules: list[str]) -> str:
    out = strip_glued_latin_tail(text.strip(), source)
    if "zh_traditional" in rules:
        out = to_traditional_chinese(out)
    if "uz_latin" in rules and (script_share(out, "Cyrl") or 0) > 0.5:
        out = uzbek_to_latin(out)
    if "ch_eszett" in rules:
        # Swiss Standard German does not use ß.
        out = out.replace("ß", "ss").replace("ẞ", "SS")
    if "sr_cyrillic" in rules and (script_share(out, "Latn") or 0) > 0.5:
        out = serbian_to_cyrillic(out)
    # Keep the source's ellipsis character.
    if source.rstrip().endswith("…") and out.endswith("...") and not out.endswith("...."):
        out = out[:-3].rstrip() + "…"
    # A source with no trailing full stop should not gain one ("Sign in" is a label).
    if source.rstrip()[-1:].isalnum() and out[-1:] in {".", "।", "。"} and not source.rstrip().endswith("."):
        out = out[:-1].rstrip()
    return out


_WORD = re.compile(r"[^\W\d_]{2,}")


def word_overlap(source: str, output: str) -> float:
    """Share of the output's words that also occur in the source (case-insensitive): 0 none, 1 all."""
    source_words = {w.lower() for w in _WORD.findall(source)}
    output_words = [w.lower() for w in _WORD.findall(output)]
    if not output_words:
        return 0.0
    return sum(1 for w in output_words if w in source_words) / len(output_words)


def repetition_ratio(text: str) -> float:
    """How much of the text is a repeated word n-gram: 0 none, 1 all."""
    words = text.split()
    if len(words) < 6:
        return 0.0
    grams = [" ".join(words[i : i + 3]) for i in range(len(words) - 2)]
    return 1 - len(set(grams)) / len(grams)
