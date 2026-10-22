// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listProductsAdminPage: vi.fn(),
  listCategoriesAdmin: vi.fn(),
  upsertProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock("@/lib/marketplace.functions", () => ({
  listProductsAdminPage: mocks.listProductsAdminPage,
  listCategoriesAdmin: mocks.listCategoriesAdmin,
  upsertProduct: mocks.upsertProduct,
  deleteProduct: mocks.deleteProduct,
}));
vi.mock("@/lib/serverFn", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ProductsAdmin } from "./MarketplaceCatalogAdmin";

const categoryId = "10000000-0000-4000-8000-000000000001";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listProductsAdminPage.mockResolvedValue({ rows: [], total: 0, ok: true });
  mocks.listCategoriesAdmin.mockResolvedValue([
    { id: categoryId, name: "Business Tools", is_hidden: false },
  ]);
  mocks.upsertProduct.mockResolvedValue({ id: "product-1" });
});

function renderProductsAdmin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ProductsAdmin />
    </QueryClientProvider>,
  );
}

describe("Marketplace Catalog Admin product creation", () => {
  it.each([true, false])(
    "requires a category and persists the selected publish state (%s)",
    async (publish) => {
      renderProductsAdmin();
      fireEvent.click(await screen.findByText("storeadmin.catalog.new_product"));

      const name = await screen.findByLabelText("storeadmin.catalog.field_name");
      const slug = screen.getByLabelText("storeadmin.catalog.field_slug");
      const category = screen.getByRole("combobox", {
        name: "storeadmin.catalog.field_category",
      });
      const save = screen.getByRole("button", { name: "storeadmin.catalog.save" });

      await screen.findByRole("option", { name: "Business Tools" });
      expect(save.hasAttribute("disabled")).toBe(true);
      fireEvent.change(name, { target: { value: "Business Suite" } });
      fireEvent.change(slug, { target: { value: "business-suite" } });
      fireEvent.change(category, { target: { value: categoryId } });

      if (!publish) {
        fireEvent.click(
          screen.getByRole("button", { name: /storeadmin\.catalog\.toggle_publish_on_create/ }),
        );
      }

      expect(save.hasAttribute("disabled")).toBe(false);
      fireEvent.click(save);

      await waitFor(() =>
        expect(mocks.upsertProduct).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: "Business Suite",
            slug: "business-suite",
            category_id: categoryId,
            publish_on_create: publish,
          }),
        }),
      );
    },
  );
});
