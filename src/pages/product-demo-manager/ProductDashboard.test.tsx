// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const demos: Record<string, unknown>[] = [];
  return { demos };
});
vi.mock("@/lib/manager/use-resource", () => ({
  useResource: (resource: string) => ({
    rows: resource === "demos" ? mocks.demos : [],
    total: resource === "demos" ? mocks.demos.length : 0,
    loading: false,
    failed: false,
  }),
}));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
import ProductDashboard from "./ProductDashboard";
afterEach(cleanup);

describe("recent demo display contract", () => {
  it("renders API names, statuses, results and measured latency", () => {
    mocks.demos = [
      {
        id: "fixture1",
        demo_name: "Fixture Demo",
        status: "active",
        last_result: "working",
        last_response_ms: 123,
      },
    ];
    render(<ProductDashboard />);
    expect(screen.getByText("Fixture Demo")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("working")).toBeTruthy();
    expect(screen.getByText("123 ms")).toBeTruthy();
  });

  it("preserves fallback names and missing-measurement states", () => {
    mocks.demos = [
      {
        id: "fixture2",
        name: "Fallback Fixture",
        status: "inactive",
        last_result: null,
        last_response_ms: null,
      },
    ];
    render(<ProductDashboard />);
    expect(screen.getByText("Fallback Fixture")).toBeTruthy();
    expect(screen.getByText("inactive")).toBeTruthy();
    expect(screen.getByText("manager.products.not_checked")).toBeTruthy();
    expect(screen.queryByText("0 ms")).toBeNull();
  });
});
