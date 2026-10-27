// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ listCategoriesAdmin: vi.fn() }));

vi.mock("@/lib/marketplace.functions", () => ({
  listProductsAdmin: vi.fn(),
  listProductsAdminPage: vi.fn(),
  upsertProduct: vi.fn(),
  deleteProduct: vi.fn(),
  layoutHistory: vi.fn(),
  layoutRestore: vi.fn(),
  listCategoriesAdmin: mocks.listCategoriesAdmin,
  upsertCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listSectionsAdmin: vi.fn(),
  setSectionEnabled: vi.fn(),
  reorderSections: vi.fn(),
}));

vi.mock("@/lib/serverFn", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "storeadmin.catalog.categories_empty"
        ? "No categories yet. Add one."
        : key === "storeadmin.catalog.new_category"
          ? "New Category"
          : key,
  }),
}));

import { CategoriesAdmin } from "./MarketplaceCatalogAdmin";

afterEach(cleanup);
beforeEach(() => {
  mocks.listCategoriesAdmin.mockReset();
});

function renderCategories() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CategoriesAdmin />
    </QueryClientProvider>,
  );
}

describe("Marketplace Categories admin", () => {
  it("shows an actionable empty state when the VPS returns no categories", async () => {
    mocks.listCategoriesAdmin.mockResolvedValue([]);
    renderCategories();

    expect(await screen.findByText("No categories yet. Add one.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "New Category" }).at(-1)!);
    expect(screen.getByRole("heading", { name: "New Category" })).toBeTruthy();
  });

  it("shows an invalid response and retries the category fetch", async () => {
    mocks.listCategoriesAdmin.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    renderCategories();

    expect(await screen.findByText("The category list response was not an array.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.listCategoriesAdmin).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No categories yet. Add one.")).toBeTruthy();
  });

  it("retries after a server read failure", async () => {
    mocks.listCategoriesAdmin
      .mockRejectedValueOnce(new Error("Fixture VPS read failure"))
      .mockResolvedValueOnce([]);
    renderCategories();

    expect(await screen.findByText("Fixture VPS read failure")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.listCategoriesAdmin).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No categories yet. Add one.")).toBeTruthy();
  });
});
