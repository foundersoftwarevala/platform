// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loaded: undefined as Record<string, unknown> | undefined,
  match: vi.fn(),
  category: vi.fn(),
  filters: vi.fn().mockResolvedValue([]),
  product: vi.fn(),
  content: vi.fn().mockResolvedValue(null),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ slug: "fixture" }),
  useNavigate: () => vi.fn(),
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
  getPublicStorefrontFilters: mocks.filters,
  getPublicProduct: mocks.product,
}));
vi.mock("@/lib/marketplace-content.functions", () => ({
  getPublishedProductContent: mocks.content,
}));
vi.mock("@/lib/marketplace-commerce.functions", () => ({ addMarketplaceCartItem: vi.fn() }));
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
  mocks.filters.mockReset().mockResolvedValue([]);
  mocks.product.mockReset();
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

  it("filters seeded category products using live storefront filter selections", async () => {
    mocks.loaded = {
      products: {
        category: { name: "Education", slug: "education", icon: "ED", description: "Fixture" },
        products: [
          {
            id: "cloud-product",
            slug: "cloud-product",
            name: "Cloud Product",
            industry_label: "Education",
            icon: "Cloud",
            price_label: "$249",
            rating: 4,
            downloads: 0,
            downloads_label: "0",
            badge: null,
            deployment: "Cloud",
            demo_urls: [],
          },
          {
            id: "premise-product",
            slug: "premise-product",
            name: "Premise Product",
            industry_label: "Education",
            icon: "Server",
            price_label: "$249",
            rating: 4,
            downloads: 0,
            downloads_label: "0",
            badge: null,
            deployment: "On-premise",
            demo_urls: [],
          },
        ],
      },
    };
    mocks.filters.mockResolvedValue([
      {
        key: "deployment",
        label: "Deployment",
        source: "deployment",
        enabled: true,
        position: 1,
        select_mode: "multi",
        combine: "or",
        visible_desktop: true,
        visible_mobile: true,
        values: [
          { value: "Cloud", label: "Cloud", count: 1 },
          { value: "On-premise", label: "On-premise", count: 1 },
        ],
      },
    ]);

    render(<CategoryDetail />, { wrapper });
    expect(await screen.findByText("Cloud Product")).toBeTruthy();
    expect(screen.getByText("Premise Product")).toBeTruthy();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Cloud/ }));
    expect(await screen.findByText("Cloud Product")).toBeTruthy();
    expect(screen.queryByText("Premise Product")).toBeNull();
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
