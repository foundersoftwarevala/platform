"""CLDR plural categories (through Babel) for generating plural branches."""

from __future__ import annotations

from functools import lru_cache

from babel import Locale

ORDER = ("zero", "one", "two", "few", "many", "other")

# Numbers tried, in order, when looking for one that falls in a category.
# Some categories hold only fractions (Russian and Polish "other"), hence the
# decimals at the end.
_CANDIDATES = (5, 1, 2, 3, 0, 4, 6, 7, 11, 21, 22, 100, 101, 102, 1000000, *range(8, 1000), 1.5, 0.5, 2.5)


@lru_cache(maxsize=256)
def _rule(tag: str):
    return Locale.parse(tag.replace("-", "_")).plural_form


def categories_for(tag: str | None) -> list[str]:
    """Plural categories of a locale, in canonical order. None: only 'other'."""
    if tag is None:
        return ["other"]
    tags = set(_rule(tag).tags) | {"other"}
    return [c for c in ORDER if c in tags]


def category_of(tag: str | None, number: int | float) -> str:
    return "other" if tag is None else _rule(tag)(number)


@lru_cache(maxsize=2048)
def sample_number(tag: str | None, category: str) -> int | float | None:
    """A number in `category` for this locale (whole if possible), or None."""
    if tag is None:
        return 5 if category == "other" else None
    rule = _rule(tag)
    for n in _CANDIDATES:
        if rule(n) == category:
            return n
    return None
