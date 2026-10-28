// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { fillCompanyFormControls, inspectEmptyCompanyFormControls } from "./ayra-autofill.browser";

describe("AYRA same-origin form fill controls", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  it("collects labels for empty supported fields but excludes sensitive and filled fields", () => {
    const page = document;
    page.body.innerHTML = `
      <label for="company_name">Company Name</label><input id="company_name" value="">
      <label for="email">Email address</label><input id="email" type="email" value="">
      <label for="card">Credit Card Number</label><input id="card" name="credit_card_number" value="">
      <label for="filled">Phone</label><input id="filled" value="Already entered">
      <label for="password">Password</label><input id="password" type="password" value="">
    `;
    const inspected = inspectEmptyCompanyFormControls(page);
    expect(inspected.fields).toEqual([
      expect.objectContaining({ index: 0, id: "company_name", label: "Company Name" }),
      expect.objectContaining({ index: 1, id: "email", label: "Email address" }),
    ]);
  });

  it("fills matching empty fields, emits input/change, and does not overwrite existing values", () => {
    const page = document;
    page.body.innerHTML = '<input name="company"><input name="phone" value="Keep this">';
    const inspected = inspectEmptyCompanyFormControls(page);
    const events: string[] = [];
    inspected.controls[0]?.addEventListener("input", () => events.push("input"));
    inspected.controls[0]?.addEventListener("change", () => events.push("change"));
    const filled = fillCompanyFormControls(
      inspected.controls,
      [{ index: 0, profileFieldName: "company_name", value: "Software Vala" }],
      page.defaultView,
    );
    expect(filled).toBe(1);
    expect((inspected.controls[0] as HTMLInputElement).value).toBe("Software Vala");
    expect((page.querySelector('[name="phone"]') as HTMLInputElement).value).toBe("Keep this");
    expect(events).toEqual(["input", "change"]);
  });

  it("selects an existing option only and never creates an option to force a fill", () => {
    const page = document;
    page.body.innerHTML = '<select name="country"><option value="">Choose</option><option value="US">United States</option></select>';
    const inspected = inspectEmptyCompanyFormControls(page);
    expect(fillCompanyFormControls(
      inspected.controls,
      [{ index: 0, profileFieldName: "country", value: "United States" }],
      page.defaultView,
    )).toBe(1);
    expect((inspected.controls[0] as HTMLSelectElement).value).toBe("US");
  });
});
