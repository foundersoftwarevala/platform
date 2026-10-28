import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = { sql: string; values: unknown[] };
type MockTx = <Rows extends unknown[]>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Rows>;
const database = vi.hoisted(() => ({ calls: [] as QueryCall[], results: [] as unknown[][] }));
vi.mock("@/lib/marketplace-manager/vps-rpc.server", () => ({
  withVpsPublicDatabase: async <T>(run: (tx: MockTx) => Promise<T>) => {
    const tx: MockTx = async <Rows extends unknown[]>(strings: TemplateStringsArray, ...values: unknown[]) => {
      database.calls.push({ sql: strings.join("?"), values });
      return (database.results.shift() ?? []) as Rows;
    };
    return run(tx);
  },
}));

import { autoFillForm } from "./ayra-autofill.server";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const profile = {
  company_name: "Software Vala",
  contact_name: "Operations Team",
  email: "hello@softwarevala.net",
  phone: "+1 555 0100",
  address: "123 Example Street",
  address_line_2: "Suite 2",
  city: "Example City",
  region: "California",
  postal_code: "90210",
  country: "United States",
  website: "https://softwarevala.net",
};

beforeEach(() => {
  database.calls = [];
  database.results = [];
});
afterEach(() => vi.restoreAllMocks());

describe("AYRA company form autofill", () => {
  it("maps only recognized fields to non-empty values from the VPS profile", async () => {
    database.results = [
      [profile],
      [
        { form_field_name: "company name", profile_field_name: "company_name" },
        { form_field_name: "email address", profile_field_name: "email" },
        { form_field_name: "postal code", profile_field_name: "postal_code" },
      ],
    ];
    const result = await autoFillForm(USER_ID, [
      { index: 0, label: "Company Name" },
      { index: 1, name: "email_address" },
      { index: 2, autocomplete: "postal-code" },
      { index: 3, label: "Credit Card Number" },
    ]);
    expect(result).toEqual([
      { index: 0, profileFieldName: "company_name", value: "Software Vala" },
      { index: 1, profileFieldName: "email", value: "hello@softwarevala.net" },
      { index: 2, profileFieldName: "postal_code", value: "90210" },
    ]);
    expect(database.calls[0]?.sql).toContain("public.ayra_company_profile");
    expect(database.calls[1]?.sql).toContain("public.ayra_form_mappings");
  });

  it("does not return company data when the profile has not been configured", async () => {
    database.results = [[], []];
    await expect(autoFillForm(USER_ID, [{ index: 0, label: "Company Name" }])).rejects.toThrow(
      "Save the Software Vala company profile",
    );
    expect(database.calls).toHaveLength(1);
  });

  it("rejects malformed or oversized input metadata before reading the database", async () => {
    await expect(autoFillForm("not-a-user", [])).rejects.toThrow("valid executive user");
    await expect(
      autoFillForm(USER_ID, Array.from({ length: 101 }, (_, index) => ({ index, name: "company" }))),
    ).rejects.toThrow();
    expect(database.calls).toHaveLength(0);
  });
});
