import { describe, expect, it } from "vitest";
import { formatMinorCurrency } from "./invoice-format";

describe("formatMinorCurrency", () => {
  it("uses each currency’s standard minor-unit precision", () => {
    expect(formatMinorCurrency(123, "INR")).toBe("₹1.23");
    expect(formatMinorCurrency(123, "JPY")).toBe("¥123");
    expect(formatMinorCurrency(1234, "KWD")).toBe("KWD 1.234");
  });

  it("rejects amounts that cannot be represented safely", () => {
    expect(() => formatMinorCurrency(-1, "USD")).toThrow(RangeError);
    expect(() => formatMinorCurrency(Number.MAX_SAFE_INTEGER + 1, "USD")).toThrow(RangeError);
  });
});
