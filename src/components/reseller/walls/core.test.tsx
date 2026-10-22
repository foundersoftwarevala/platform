import { describe, expect, it } from "vitest";
import { customersConfig } from "./core";

describe("reseller customer creation", () => {
  it("requires selecting the reseller that will own the customer", () => {
    expect(customersConfig.formFields).toContainEqual(
      expect.objectContaining({
        key: "reseller_id",
        type: "resource-select",
        optionsResource: "resellers",
        optionValue: "id",
        optionLabel: "name",
        required: true,
        createOnly: true,
      }),
    );
  });
});
