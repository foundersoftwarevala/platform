import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDate,
  formatMessage,
  formatNumber,
  hasArguments,
  pluralCategories,
} from "../format";

describe("formatMessage", () => {
  it("fills simple arguments", () => {
    expect(formatMessage("Hello {name}, welcome back.", { name: "Amit" }, "en")).toBe(
      "Hello Amit, welcome back.",
    );
    expect(formatMessage("Hello {name}", {}, "en")).toBe("Hello {name}");
  });

  it("formats numbers and dates in the language's own locale", () => {
    expect(formatMessage("{n, number} items", { n: 12345.6 }, "de")).toBe("12.345,6 items");
    expect(formatMessage("{n, number, integer}", { n: 12345.6 }, "en")).toBe("12,346");
    expect(formatMessage("{n, number, percent}", { n: 0.25 }, "en")).toBe("25%");
    expect(
      formatMessage("{d, date, short}", { d: new Date(Date.UTC(2026, 8, 17)) }, "en"),
    ).toContain("26");
  });

  it("chooses the plural branch by the language's rules", () => {
    const message = "{count, plural, one {# item} other {# items}}";
    expect(formatMessage(message, { count: 1 }, "en")).toBe("1 item");
    expect(formatMessage(message, { count: 7 }, "en")).toBe("7 items");
    // Japanese has one category, so every count uses "other".
    expect(formatMessage(message, { count: 1 }, "ja")).toBe("1 items");
    // Samoan does not inflect for count at all (pluralLocale is null).
    expect(formatMessage(message, { count: 3 }, "sm")).toBe("3 items");
  });

  it("uses the branch a language actually has", () => {
    const russian = "{count, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}";
    expect(formatMessage(russian, { count: 1 }, "ru")).toBe("1 файл");
    expect(formatMessage(russian, { count: 3 }, "ru")).toBe("3 файла");
    expect(formatMessage(russian, { count: 11 }, "ru")).toBe("11 файлов");
  });

  it("honours exact matches and offset", () => {
    const message = "{count, plural, =0 {nothing yet} one {# item} other {# items}}";
    expect(formatMessage(message, { count: 0 }, "en")).toBe("nothing yet");
    const offset = "{count, plural, offset:1 one {you and one other} other {you and # others}}";
    expect(formatMessage(offset, { count: 2 }, "en")).toBe("you and one other");
    expect(formatMessage(offset, { count: 4 }, "en")).toBe("you and 3 others");
  });

  it("handles select and nesting", () => {
    const message =
      "{gender, select, female {She has {n, plural, one {# point} other {# points}}} other {They have {n, plural, one {# point} other {# points}}}}";
    expect(formatMessage(message, { gender: "female", n: 1 }, "en")).toBe("She has 1 point");
    expect(formatMessage(message, { gender: "other", n: 5 }, "en")).toBe("They have 5 points");
  });

  it("reads '' as a literal apostrophe and leaves a broken message alone", () => {
    expect(formatMessage("It''s ready", {}, "en")).toBe("It's ready");
    expect(formatMessage("{count, plural, one {x}", { count: 1 }, "en")).toBe(
      "{count, plural, one {x}",
    );
  });

  it("falls back to the 'other' branch when the value is not a number", () => {
    expect(
      formatMessage("{count, plural, one {# item} other {many items}}", { count: "x" }, "en"),
    ).toBe("many items");
  });

  it("knows whether a message needs values", () => {
    expect(hasArguments("Apply Now")).toBe(false);
    expect(hasArguments("Hello {name}")).toBe(true);
  });
});

describe("formatters", () => {
  it("formats numbers, currency and dates per language", () => {
    expect(formatNumber(1234.5, "hi")).toBe("1,234.5");
    expect(formatNumber(1234.5, "de")).toBe("1.234,5");
    expect(formatCurrency(99, "USD", "en")).toBe("$99.00");
    expect(formatDate(new Date(Date.UTC(2026, 8, 17)), "en", { dateStyle: "medium" })).toContain(
      "2026",
    );
    expect(formatDate("not a date", "en")).toBe("");
  });

  it("uses the substitute formatting locale where CLDR has no data for the language", () => {
    // Samoan formats as en-WS, Guarani as es-PY.
    expect(formatNumber(1234.5, "sm")).toBe("1,234.5");
    expect(formatNumber(1234.5, "gn")).toBe("1.234,5");
  });

  it("reports plural categories", () => {
    expect(pluralCategories("en")).toEqual(["one", "other"]);
    expect(pluralCategories("ar")).toEqual(["zero", "one", "two", "few", "many", "other"]);
    expect(pluralCategories("sm")).toEqual(["other"]);
    expect(pluralCategories("mai")).toEqual(["one", "other"]);
  });
});
