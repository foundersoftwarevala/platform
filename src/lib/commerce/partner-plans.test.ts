import { describe, expect, it } from "vitest";

import { FRANCHISE_PLANS, quoteFor } from "./partner-plans";

describe("franchise marketplace quotes", () => {
  it("quotes list price because checkout does not apply franchise discounts", () => {
    const quote = quoteFor(249.99, FRANCHISE_PLANS[0], true);

    expect(quote).toMatchObject({
      listPriceUsd: 249.99,
      discount: 0,
      discountLabel: "0%",
      savingUsd: 0,
      finalPriceUsd: 249.99,
      plan: "city",
    });
    expect(quote.reason).toContain("list price applies");
  });
});
