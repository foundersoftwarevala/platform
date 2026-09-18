"""Unit tests for text handling, ICU messages and plural rules. No model needed."""

import pytest

from sv_translate import icu
from sv_translate import text as tx
from sv_translate.plural import categories_for, category_of, sample_number


def test_normalize_nfc_newlines_and_controls():
    assert tx.normalize("Café\r\nok\x07") == "Café\nok"


def test_mask_and_unmask_every_placeholder_kind():
    source = 'Hi {name}, {{count}} items, %s, %1$d <b>x</b> ⟦T0⟧ https://softwarevala.net/a. mail@x.io'
    masked = tx.mask(source)
    assert "{name}" not in masked.text and "https://" not in masked.text and "<b>" not in masked.text
    assert masked.originals == ["{name}", "{{count}}", "%s", "%1$d", "<b>", "</b>", "⟦T0⟧", "https://softwarevala.net/a", "mail@x.io"]
    restored, missing = tx.unmask(masked.text, masked.originals)
    assert restored == source and missing == []


def test_unmask_reports_lost_tokens_and_tolerates_spacing():
    masked = tx.mask("Hello {name} and {other}")
    restored, missing = tx.unmask("Hola ⟦ P0 ⟧", masked.originals)
    assert restored == "Hola {name}"
    assert missing == [1]


def test_preferred_terms_are_protected_and_rendered():
    masked = tx.mask("Go to checkout now", {"checkout": "Finalizar compra"})
    assert "checkout" not in masked.text
    assert tx.unmask(masked.text, masked.originals)[0] == "Go to Finalizar compra now"


def test_segment_keeps_whitespace_and_skips_non_text():
    units = tx.segment("  Hello\n\n42\nWorld  ")
    assert "".join(u.text for u in units) == "  Hello\n\n42\nWorld  "
    assert [u.text for u in units if u.translate] == ["Hello", "World"]


def test_segment_splits_long_lines_into_sentences():
    line = ("This is a sentence. " * 30).strip()
    pieces = [u.text for u in tx.segment(line) if u.translate]
    assert len(pieces) == 30
    assert all(p == "This is a sentence." for p in pieces)


def test_needs_translation():
    assert tx.needs_translation("Hello") is True
    assert tx.needs_translation("⟦P0⟧ 42 %") is False


def test_script_share():
    assert tx.script_share("नमस्ते दुनिया", "Deva") == 1.0
    assert tx.script_share("Hello", "Deva") == 0.0
    assert tx.script_share("123", "Deva") is None


def test_serbian_transliteration_leaves_tokens():
    assert tx.serbian_to_cyrillic("Jezik ⟦P0⟧ Ljubljana džak") == "Језик ⟦P0⟧ Љубљана џак"


def test_postprocess_rules():
    assert tx.postprocess("Straße und Maß", "x", ["ch_eszett"]) == "Strasse und Mass"
    assert tx.postprocess("Jezik", "Language", ["sr_cyrillic"]) == "Језик"
    assert tx.postprocess("Chargement...", "Loading…", []) == "Chargement…"
    assert tx.postprocess("Se connecter.", "Sign in", []) == "Se connecter"
    assert tx.postprocess("C'est fini.", "It is done.", []) == "C'est fini."


def test_repetition_ratio():
    assert tx.repetition_ratio("one two three") == 0.0
    assert tx.repetition_ratio("buy now buy now buy now buy now buy now") > 0.3


def test_icu_round_trip_and_structure():
    message = "You have {count, plural, offset:1 =0 {no items} one {# item} other {# items}} in {place}. It''s {kind, select, a {A} other {B}}"
    nodes = icu.parse(message)
    assert icu.has_complex(message)
    block = next(n for n in nodes if isinstance(n, icu.Block))
    assert block.kind == "plural" and block.offset == 1
    assert list(block.options) == ["=0", "one", "other"]
    assert any(isinstance(n, icu.Pound) for n in block.options["one"])
    assert icu.parse(icu.serialize(nodes)) == nodes


@pytest.mark.parametrize(
    "bad",
    ["{count, plural, one {x}}", "{count, plural, other {x}", "{a", "text }", "{, plural, other {x}}"],
)
def test_icu_rejects_malformed(bad):
    with pytest.raises(icu.MessageError):
        icu.parse(bad)


def test_simple_arguments_are_not_complex():
    assert not icu.has_complex("Hello {name}, you owe {amount, number, currency}")


def test_plural_categories_follow_cldr():
    assert categories_for("en-US") == ["one", "other"]
    assert categories_for("ru-RU") == ["one", "few", "many", "other"]
    assert categories_for("ar-SA") == ["zero", "one", "two", "few", "many", "other"]
    assert categories_for("ja-JP") == ["other"]
    assert categories_for(None) == ["other"]


def test_sample_numbers_fall_in_their_category():
    for tag in ["en-US", "ru-RU", "ar-SA", "pl-PL", "cy-GB", "fr-FR", "fa", "sw"]:
        for category in categories_for(tag):
            n = sample_number(tag, category)
            assert n is not None, (tag, category)
            assert category_of(tag, n) == category


def test_uzbek_transliteration_leaves_tokens():
    assert tx.uzbek_to_latin("Ишинг тасдиқланди ⟦P0⟧") == "Ishing tasdiqlandi ⟦P0⟧"
    assert tx.uzbek_to_latin("Ўзбекча ёзув: Ғалаба, Чоршанба") == "Oʻzbekcha yozuv: Gʻalaba, Chorshanba"
    assert tx.postprocess("Ишинг тасдиқланди", "Your order is confirmed", ["uz_latin"]) == "Ishing tasdiqlandi"
    # Latin input is left as it is.
    assert tx.postprocess("Ishing tasdiqlandi", "x", ["uz_latin"]) == "Ishing tasdiqlandi"


def test_glued_latin_tail_is_removed_only_when_the_source_lacks_it():
    # MADLAD's "Name" trace on short Hebrew labels.
    assert tx.postprocess("ארנק דיגיטליName", "Digital Wallet", []) == "ארנק דיגיטלי"
    assert tx.postprocess("שירותי אירועיםName", "Event Services", []) == "שירותי אירועים"
    # A Latin word the source really contains stays.
    assert tx.postprocess("הורד את Vala", "Download Vala", []) == "הורד את Vala"
    assert tx.postprocess("פתחו אתVala", "Open Vala", []) == "פתחו אתVala"
    # Latin-script output is never touched.
    assert tx.postprocess("Carteira DigitalName", "Digital Wallet", []) == "Carteira DigitalName"


def test_traditional_chinese_output_has_no_simplified_characters():
    assert tx.postprocess("成為供应商", "Become Vendor", ["zh_traditional"]) == "成為供應商"
    assert tx.postprocess("计算器", "Calculator", ["zh_traditional"]) == "計算器"
    # Placeholders are left as they are.
    assert tx.postprocess("你好 ⟦P0⟧，欢迎", "Hello {name}, welcome", ["zh_traditional"]) == "你好 ⟦P0⟧，歡迎"
    # Without the rule nothing changes.
    assert tx.postprocess("成為供应商", "Become Vendor", []) == "成為供应商"
