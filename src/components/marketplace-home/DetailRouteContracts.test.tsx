// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loaded: undefined as Record<string, unknown> | undefined,
  match: vi.fn(),
  category: vi.fn(),
  product: vi.fn(),
  navigate: vi.fn(),
  commerce: vi.fn(),
  content: vi.fn().mockResolvedValue(null),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ slug: "fixture" }),
  useNavigate: () => mocks.navigate,
  useMatch: (options: object) => {
    mocks.match(options);
    return mocks.loaded ? { loaderData: mocks.loaded } : undefined;
  },
  Link: ({
    to,
    params,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: { section?: string } }) => (
    <a {...props} href={params?.section ? to.replace("$section", params.section) : to} />
  ),
}));
vi.mock("@/lib/marketplace.functions", () => ({
  getPublicProductsByCategory: mocks.category,
  getPublicProduct: mocks.product,
}));
vi.mock("@/lib/marketplace-content.functions", () => ({
  getPublishedProductContent: mocks.content,
}));
vi.mock("@/lib/marketplace-commerce.functions", () => ({
  addMarketplaceCartItem: mocks.commerce,
}));
vi.mock("@/lib/serverFn", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/marketplace/useActionLayer", () => ({ useProductActions: () => ({ actions: [] }) }));
vi.mock("@/components/marketplace-home/FloatingElements", () => ({ DemoForm: () => null }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/chat/ChatAppButton", () => ({ ChatAppButton: () => null }));
import { CategoryDetail } from "./CategoryDetail";
import { ProductDetail } from "./ProductDetail";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}
beforeEach(() => {
  mocks.loaded = undefined;
  mocks.match.mockClear();
  mocks.category.mockReset();
  mocks.product.mockReset();
  mocks.navigate.mockReset();
  mocks.commerce.mockReset();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);

describe("optional matching route loader data", () => {
  it("renders seeded category products without fetching again", () => {
    mocks.loaded = {
      products: {
        category: { name: "Seeded category", icon: "SC", description: "Fixture" },
        products: [],
      },
    };
    render(<CategoryDetail />, { wrapper });
    expect(screen.getByText("Seeded category")).toBeTruthy();
    expect(mocks.match).toHaveBeenCalledWith({
      from: "/marketplace/category/$slug",
      shouldThrow: false,
    });
    expect(mocks.category).not.toHaveBeenCalled();
  });

  it("retains category query fallback when no matching route has loader data", async () => {
    mocks.category.mockResolvedValue({
      category: { name: "Fetched category", icon: "FC", description: "Fixture" },
      products: [],
    });
    render(<CategoryDetail />, { wrapper });
    expect(await screen.findByText("Fetched category")).toBeTruthy();
    expect(mocks.category).toHaveBeenCalledWith({ data: { category_slug: "fixture" } });
  });

  it("renders seeded product data and keeps the product route identity", () => {
    mocks.loaded = {
      product: {
        product: {
          id: "product-fixture",
          slug: "fixture",
          name: "Seeded product",
          icon: "SP",
          description: "Fixture",
          rating: 0,
          downloads: 0,
          tags: [],
          features: [],
          tech_stack: [],
        },
        active_demos: [],
      },
    };
    render(<ProductDetail />, { wrapper });
    expect(screen.getAllByText("Seeded product").length).toBeGreaterThan(0);
    expect(mocks.match).toHaveBeenCalledWith({
      from: "/marketplace/product/$slug",
      shouldThrow: false,
    });
    expect(mocks.product).not.toHaveBeenCalled();
  });

  it("preserves the Buy Now marker when an unsigned buyer is sent to login", async () => {
    mocks.loaded = {
      product: {
        product: {
          id: "product-fixture",
          slug: "fixture",
          name: "Seeded product",
          icon: "SP",
          description: "Fixture",
          rating: 0,
          downloads: 0,
          tags: [],
          features: [],
          tech_stack: [],
          visible: true,
          content_status: "published",
        },
        active_demos: [],
      },
    };
    mocks.commerce.mockRejectedValue(new Error("unauthorized"));
    window.history.replaceState({}, "", "/marketplace/product/fixture?buy=1");

    render(<ProductDetail />, { wrapper });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/login",
        search: { redirect: "/marketplace/product/fixture?buy=1" },
      });
    });
  });

  it("retains missing-product query fallback without throwing a missing-loader error", async () => {
    mocks.product.mockResolvedValue({ product: null });
    render(<ProductDetail />, { wrapper });
    expect(await screen.findByText("marketplace.product.not_found_title")).toBeTruthy();
    expect(mocks.product).toHaveBeenCalledWith({ data: { slug: "fixture" } });
  });

  it("keeps the settings destination URL using typed dynamic route params", () => {
    render(<CreatorTopBar />);
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
      "/manager/settings",
    );
  });
});
