// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketplace-manager/sections/DemoUrlManager", () => ({
  DemoUrlManagerSection: () => <div>Canonical demo URL manager fixture</div>,
}));
vi.mock("@/lib/demo-manager/demos.functions", () => {
  throw new Error("The retired Add Demo wizard must not import its category service");
});
import AddDemo from "./AddDemo";
afterEach(cleanup);

describe("Add Demo canonical delegation", () => {
  it("keeps the lazy canonical manager, with no old wizard or duplicate write path", async () => {
    const onSuccess = vi.fn();
    render(<AddDemo onSuccess={onSuccess} />);
    expect(await screen.findByText("Canonical demo URL manager fixture")).toBeTruthy();
    expect(screen.queryByText("Demo Title *")).toBeNull();
    expect(screen.queryByText("Search the catalogue")).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
