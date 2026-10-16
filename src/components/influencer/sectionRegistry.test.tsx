// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/creator/ModuleDashboard", () => ({ ModuleDashboard: () => null }));
vi.mock("@/components/creator/moduleConfigs", () => ({ influencerConfig: {} }));
vi.mock("@/components/influencer/InfluencerReferenceDashboard", () => ({
  InfluencerReferenceDashboard: () => null,
}));
vi.mock("@/lib/auth/operator-fetch", () => ({ authHeaders: async () => ({}) }));
import { influencerRegistry } from "./sectionRegistry";
import { ManagerWall, type WallConfig } from "@/components/manager-suite/wall";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ rows: [], retirable: false })),
  );
});
function config(section: string): WallConfig {
  const value = influencerRegistry[section];
  if (!value || typeof value === "function") throw new Error(`Missing wall config: ${section}`);
  return value;
}
describe("influencer read-only creation contract", () => {
  it("uses the existing creatable flag for workflow and fallback walls", () => {
    const restricted = Object.values(influencerRegistry).filter(
      (value): value is WallConfig => typeof value !== "function" && value.creatable === false,
    );
    expect(restricted.length).toBeGreaterThan(10);
    expect(restricted.some((value) => Boolean(value.resource))).toBe(true);
    expect(restricted.some((value) => !value.resource)).toBe(true);
    expect(
      Object.values(influencerRegistry).some(
        (value) => typeof value !== "function" && "canCreate" in value,
      ),
    ).toBe(false);
  });

  it("does not offer creation for the connected order payout workflow", async () => {
    const wall = config("Order Payouts");
    expect(wall.resource).toBeTruthy();
    render(<ManagerWall config={wall} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: wall.primaryLabel })).toBeNull();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });

  it("retains creation for an ordinary editable wall", async () => {
    const wall = config("Order Payouts");
    render(<ManagerWall config={{ ...wall, creatable: true }} />);
    expect(screen.getByRole("button", { name: wall.primaryLabel })).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });
});
