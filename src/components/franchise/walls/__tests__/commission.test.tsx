// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManagerWall } from "@/components/manager-suite/wall";
import { config as analyticsConfig } from "../analytics";
import { config as commissionConfig } from "../commission";
import { config as reportsConfig } from "../reports";

vi.mock("@/lib/auth/operator-fetch", () => ({
  authHeaders: async () => ({}),
}));

const royalty = {
  id: "royalty-1",
  franchise_id: "franchise-1",
  period: "2026-06",
  gross_sales: 125000,
  royalty_due: 12500,
  paid_amount: 10000,
  status: "paid",
};

const walls = [
  ["Commission", commissionConfig],
  ["Reports", reportsConfig],
  ["Analytics", analyticsConfig],
] as const;

describe("franchise royalty walls", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ rows: [royalty], retirable: false }),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it.each(walls)("%s renders every canonical royalty field read-only", async (_name, config) => {
    render(<ManagerWall config={config} />);

    const table = await screen.findByRole("table");
    const row = await screen.findByRole("row", { name: /2026-06/ });
    const cells = within(row).getAllByRole("cell");

    expect(within(table).getByRole("columnheader", { name: "Period" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Gross Sales" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Royalty Due" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Paid Amount" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "",
      "2026-06",
      "125000",
      "12500",
      "10000",
      "Paid",
      "",
    ]);
    expect(
      screen.queryByRole("button", { name: /new record|create|edit|delete/i }),
    ).not.toBeInTheDocument();
  });
});
