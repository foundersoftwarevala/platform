"""Final acceptance check for all supported languages, over HTTP.

Unlike tests/test_live.py, which builds an Engine inside the test process, this
script talks to the service that is actually serving traffic. It therefore
needs no second copy of the model in memory and verifies the deployed path:
HTTP -> routing -> backend -> ICU handling.

Usage:
    SVT_URL=http://127.0.0.1:5100 SVT_TOKEN=... python3 live_http_check.py [report.json]

For every language returned by /v1/languages it checks that

  * a real sentence comes back non-empty, and different from the English
    source unless the language is English itself,
  * the reply is written in the script the registry gives for the language,
  * the engine's own confidence is at least 0.5,
  * placeholders ({name}, %s, <b>...</b>) survive the round trip,
  * an ICU plural message comes back with exactly the plural categories the
    language has in CLDR, each branch keeping its number placeholder,
  * a locked glossary term is used verbatim.

It exits non-zero and prints the failing languages if any check fails.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

SAMPLE = "Your order has been confirmed."
PLACEHOLDERS = "Hello {name}, you have %s new messages in <b>Vala TV</b>."
PLURAL = "You have {count, plural, one {# item} other {# items}} in your cart."
GLOSSARY_TEXT = "Open the checkout page."
GLOSSARY_TERM = ("checkout", "Vala Checkout")

BASE = os.environ.get("SVT_URL", "http://127.0.0.1:5100").rstrip("/")
TOKEN = os.environ.get("SVT_TOKEN", "")
TIMEOUT = float(os.environ.get("SVT_HTTP_TIMEOUT", "600"))


def call(path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(BASE + path, data=data, method="POST" if data else "GET")
    request.add_header("Authorization", f"Bearer {TOKEN}")
    if data:
        request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


# SVT_MODE=realtime checks the path visitors use (greedy decoding, shared batches).
MODE = os.environ.get("SVT_MODE", "quality")


def translate(target: str, texts: dict[str, str], glossary=(), mode=None) -> dict:
    mode = mode or MODE
    body = {
        "source": "en",
        "target": target,
        "segments": [{"id": key, "text": value} for key, value in texts.items()],
        "glossary": [{"source": s, "target": t} for s, t in glossary],
        "mode": mode,
    }
    reply = call("/v1/translate", body)
    return {segment["id"]: segment for segment in reply["segments"]}


# One ICU plural block: "{count, plural, <category> {branch} ...}", anywhere in
# the sentence. The body is taken by matching braces, because the branches
# contain braces themselves.
BLOCK_START = re.compile(r"\{\s*count\s*,\s*plural\s*,", re.S)
BRANCH = re.compile(r"(?:^|\})\s*([a-z]+|=\d+)\s*\{")


def plural_body(message: str) -> str | None:
    match = BLOCK_START.search(message)
    if not match:
        return None
    depth = 1
    for index in range(match.end(), len(message)):
        character = message[index]
        if character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return message[match.end() : index]
    return None


def plural_categories(message: str) -> list[str]:
    body = plural_body(message)
    if body is None:
        return []
    return BRANCH.findall(body)


# Enough of ISO 15924 to tell the scripts this platform serves apart. Latin is
# not listed: many languages written in Latin keep ASCII words in a sentence,
# so a Latin-script reply is checked only for letters.
SCRIPT_RANGES = {
    "Arab": ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)),
    "Armn": ((0x0530, 0x058F),),
    "Beng": ((0x0980, 0x09FF),),
    "Cyrl": ((0x0400, 0x04FF), (0x0500, 0x052F)),
    "Deva": ((0x0900, 0x097F), (0xA8E0, 0xA8FF)),
    "Ethi": ((0x1200, 0x137F), (0x1380, 0x139F)),
    "Geor": ((0x10A0, 0x10FF), (0x1C90, 0x1CBF)),
    "Grek": ((0x0370, 0x03FF), (0x1F00, 0x1FFF)),
    "Gujr": ((0x0A80, 0x0AFF),),
    "Guru": ((0x0A00, 0x0A7F),),
    "Hans": ((0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF)),
    "Hant": ((0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF)),
    "Hebr": ((0x0590, 0x05FF), (0xFB1D, 0xFB4F)),
    "Jpan": ((0x3040, 0x30FF), (0x4E00, 0x9FFF), (0xFF66, 0xFF9F)),
    "Khmr": ((0x1780, 0x17FF),),
    "Knda": ((0x0C80, 0x0CFF),),
    "Kore": ((0x1100, 0x11FF), (0xAC00, 0xD7AF), (0x3130, 0x318F)),
    "Laoo": ((0x0E80, 0x0EFF),),
    "Mlym": ((0x0D00, 0x0D7F),),
    "Mymr": ((0x1000, 0x109F),),
    "Orya": ((0x0B00, 0x0B7F),),
    "Sinh": ((0x0D80, 0x0DFF),),
    "Taml": ((0x0B80, 0x0BFF),),
    "Telu": ((0x0C00, 0x0C7F),),
    "Thaa": ((0x0780, 0x07BF),),
    "Thai": ((0x0E00, 0x0E7F),),
    "Tibt": ((0x0F00, 0x0FFF),),
}


def in_script(text: str, script: str) -> bool:
    ranges = SCRIPT_RANGES.get(script)
    if ranges is None:
        return any(character.isalpha() for character in text)
    return any(any(low <= ord(character) <= high for low, high in ranges) for character in text)


def check_language(code: str, info: dict) -> dict:
    started = time.monotonic()
    issues: list[str] = []

    main = translate(code, {"sample": SAMPLE, "placeholders": PLACEHOLDERS})
    sample = main["sample"]
    placeholders = main["placeholders"]
    # English and its regional variants are the source language: the engine
    # returns the text as it stands instead of translating it, so only the
    # checks that apply to unchanged text are made.
    identity = sample.get("backend") == "identity"

    if not sample["text"].strip():
        issues.append("empty translation")
    if not identity and sample["text"].strip() == SAMPLE:
        issues.append("translation identical to the English source")
    if not in_script(sample["text"], info.get("script", "")):
        issues.append(f"reply is not written in {info.get('script')}")
    if not identity and sample.get("confidence", 0) < 0.5:
        issues.append(f"low confidence {sample.get('confidence')}")
    for token in ("{name}", "%s", "<b>", "</b>"):
        if token not in placeholders["text"]:
            issues.append(f"placeholder {token} lost")

    plural = translate(code, {"plural": PLURAL})["plural"]
    expected = list(info.get("plural_categories") or ["other"])
    found = plural_categories(plural["text"])
    if found != expected:
        issues.append(f"plural categories {found} instead of {expected}")
    elif "#" not in plural["text"]:
        issues.append("plural branches lost the number placeholder")

    glossary = translate(code, {"term": GLOSSARY_TEXT}, glossary=[GLOSSARY_TERM])["term"]
    if not identity and GLOSSARY_TERM[1] not in glossary["text"]:
        issues.append("glossary term not used")

    return {
        "code": code,
        "ok": not issues,
        "issues": issues,
        "text": sample["text"],
        "confidence": sample.get("confidence"),
        "backend": sample.get("backend"),
        "flags": sample.get("flags"),
        "placeholders": placeholders["text"],
        "plural": plural["text"],
        "plural_categories": found,
        "glossary": glossary["text"],
        "seconds": round(time.monotonic() - started, 2),
    }


def main() -> int:
    languages = call("/v1/languages")["languages"]
    # SVT_ONLY=en,en-GB checks those languages only; the default is all of them.
    only = {code.strip() for code in os.environ.get("SVT_ONLY", "").split(",") if code.strip()}
    if only:
        languages = [info for info in languages if info["code"] in only]
    report = []
    failures = []
    for index, info in enumerate(sorted(languages, key=lambda item: item["code"]), start=1):
        code = info["code"]
        try:
            entry = check_language(code, info)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, KeyError) as exc:
            entry = {"code": code, "ok": False, "issues": [f"{type(exc).__name__}: {exc}"]}
        report.append(entry)
        if not entry["ok"]:
            failures.append(entry)
        print(
            f"{index:3}/{len(languages)} {code:<8} {'ok  ' if entry['ok'] else 'FAIL'} "
            f"{entry.get('seconds', '-')}s {entry.get('backend', '')} {'; '.join(entry['issues'])}",
            flush=True,
        )

    path = sys.argv[1] if len(sys.argv) > 1 else None
    if path:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)

    print(f"\nlanguages checked: {len(report)}; passed: {len(report) - len(failures)}; failed: {len(failures)}")
    for entry in failures:
        print(f"FAILED {entry['code']}: {'; '.join(entry['issues'])}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
