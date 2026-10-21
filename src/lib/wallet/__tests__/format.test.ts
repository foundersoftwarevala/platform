import { describe, expect, it } from "vitest";
import { formatWalletAmount } from "../format";

describe("formatWalletAmount", () => {
  it("formats cents as currency without losing fractional values", () => {
    expect(formatWalletAmount("123450", "INR")).toBe("₹1,234.50");
  });

  it("preserves precision for balances larger than JavaScript's safe integer range", () => {
    expect(formatWalletAmount("9007199254740993", "INR")).toBe("₹9,00,71,99,25,47,409.93");
  });

  it("rejects non-integer cent values", () => {
    expect(() => formatWalletAmount("12.5", "INR")).toThrow(
      "Wallet amount is not a whole number of cents.",
    );
  });
});
