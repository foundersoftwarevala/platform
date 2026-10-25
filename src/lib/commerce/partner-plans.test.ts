import { describe, expect, it } from "vitest";

import { FRANCHISE_PLANS, quoteFor } from "./partner-plans";

describe("franchise marketplace quotes", () => {
  it("applies the configured franchise discount to the quoted price", () => {
    const quote = quoteFor(249.99, FRANCHISE_PLANS[0], true);

    expect(quote).toMatchObject({
      listPriceUsd: 249.99,
      discount: 0.3,
      discountLabel: "30%",
      savingUsd: 75,
      finalPriceUsd: 174.99,
      plan: "city",
    });
    expect(quote.reason).toContain("franchise pricing applies");
  });
});
