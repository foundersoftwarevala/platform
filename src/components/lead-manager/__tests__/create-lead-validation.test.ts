import { describe, expect, it } from "vitest";
import { validate } from "@/components/lead-manager/CreateLeadDialog";

/**
 * What the Add Lead form refuses, and what it lets through.
 *
 * Before this, the form checked only that the three required boxes were not
 * empty, and did so with a bare `return` that showed nothing. The submit button
 * is disabled while they are empty, so what that guard really hid was the other
 * half: "abc@" and "123" were accepted and written to the database. A lead
 * nobody can reply to is not a lead.
 */

const ok = { name: "Asha", email: "asha@example.com", phone: "9876543210", deal_value: "" };

describe("validate — required fields", () => {
  it("accepts a complete, well-formed lead", () => {
    expect(validate(ok)).toEqual({});
  });

  it("names each missing field instead of failing silently", () => {
    const errors = validate({ name: "  ", email: "", phone: "", deal_value: "" });
    expect(errors.name).toMatch(/required/i);
    expect(errors.email).toMatch(/required/i);
    expect(errors.phone).toMatch(/required/i);
  });
});

describe("validate — email", () => {
  it("rejects addresses that could never receive a reply", () => {
    for (const email of ["abc", "abc@", "@example.com", "abc@example", "a b@example.com", "abc@.com"]) {
      expect(validate({ ...ok, email }).email, email).toBeTruthy();
    }
  });

  it("accepts ordinary and slightly unusual addresses", () => {
    for (const email of [
      "asha@example.com",
      "asha.verma@example.co.in",
      "asha+leads@example.com",
      "a@b.co",
      "asha_verma@sub.example.com",
    ]) {
      expect(validate({ ...ok, email }).email, email).toBeUndefined();
    }
  });
});

describe("validate — phone", () => {
  it("rejects numbers too short to dial", () => {
    for (const phone of ["1", "123", "123456"]) {
      expect(validate({ ...ok, phone }).phone, phone).toMatch(/7 digits/i);
    }
  });

  it("rejects numbers longer than any real one", () => {
    expect(validate({ ...ok, phone: "1234567890123456" }).phone).toMatch(/longer/i);
  });

  it("counts digits, so punctuation and country codes are fine", () => {
    for (const phone of ["9876543210", "+91 98765 43210", "(022) 1234-5678", "+1-555-0100"]) {
      expect(validate({ ...ok, phone }).phone, phone).toBeUndefined();
    }
  });
});

describe("validate — deal value", () => {
  it("leaves an empty deal value alone, because it is optional", () => {
    expect(validate({ ...ok, deal_value: "" }).deal_value).toBeUndefined();
  });

  it("refuses a negative amount", () => {
    expect(validate({ ...ok, deal_value: "-5000" }).deal_value).toMatch(/negative/i);
  });

  it("refuses something that is not a number", () => {
    expect(validate({ ...ok, deal_value: "five lakh" }).deal_value).toMatch(/number/i);
  });

  it("accepts a real amount", () => {
    expect(validate({ ...ok, deal_value: "250000" }).deal_value).toBeUndefined();
  });
});
