import { describe, expect, it } from "vitest";

import { singleCurrencyAmount, sumByCurrency } from "./money-by-currency";

describe("money by currency", () => {
  it("groups and rounds amounts without combining currencies", () => {
    const amounts = sumByCurrency(
      [
        { currency: "USD", amount: 12.345 },
        { currency: "inr", amount: 100 },
        { currency: "USD", amount: 2.005 },
      ],
      (row) => row.currency,
      (row) => row.amount,
    );

    expect(amounts).toEqual([
      { currency: "INR", amount: 100 },
      { currency: "USD", amount: 14.35 },
    ]);
    expect(singleCurrencyAmount(amounts)).toBeNull();
  });

  it("does not guess a currency for missing currency data", () => {
    expect(
      sumByCurrency([{ amount: 10 }], () => null, (row) => row.amount),
    ).toEqual([{ currency: "UNKNOWN", amount: 10 }]);
  });
});
