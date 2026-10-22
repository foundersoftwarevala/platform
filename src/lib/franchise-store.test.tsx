// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

import { useFranchise } from "@/lib/franchise-store";

const franchiseId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
  });
  mocks.from.mockImplementation((table: string) => {
    let offset = 0;
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn((start: number) => {
        offset = start;
        return builder;
      }),
      then: (
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null,
      ) => {
        let data: unknown = [];
        if (table === "franchises") data = [{ id: franchiseId }];
        if (table === "franchise_product_assignments") {
          const length = offset === 0 ? 500 : offset === 500 ? 1 : 0;
          data = Array.from({ length }, (_, index) => {
            const id = `product-${offset + index}`;
            return {
              franchise_id: franchiseId,
              product_id: id,
              product: {
                id,
                name: `Product ${offset + index}`,
                slug: id,
                description: "",
                thumbnail_url: "",
                logo: "",
                price_label: "",
                industry_label: "",
                demo_url: "",
              },
            };
          });
        }
        return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
      },
    };
    return builder;
  });
});

afterEach(cleanup);

describe("franchise assigned products", () => {
  it("loads assignments past a single response page with one joined query per page", async () => {
    const { result } = renderHook(() => useFranchise());

    await waitFor(() => expect(result.current.products).toHaveLength(501));

    expect(result.current.products[0]).toMatchObject({ id: "product-0", name: "Product 0" });
    expect(result.current.products[500]).toMatchObject({ id: "product-500", name: "Product 500" });
    expect(
      mocks.from.mock.calls.filter(([table]) => table === "franchise_product_assignments"),
    ).toHaveLength(2);
  });
});
