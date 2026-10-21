// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthorProductsWorkspace } from "./AuthorProductsWorkspace";
import { ROLES } from "@/lib/roles";

vi.mock("@/lib/auth/operator-fetch", () => ({
  authHeaders: vi.fn(async () => ({ Authorization: "Bearer fixture" })),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthorProductsWorkspace role={ROLES.author} onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("author product workspace", () => {
  it("loads and creates a hidden draft through the author API", async () => {
    const calls: { method: string; body?: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const body = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        calls.push({ method, body });
        if (method === "GET") return Response.json({ products: [], categories: [] });
        return Response.json({ ok: true, created: true, product: { id: "p1" } }, { status: 201 });
      }),
    );

    mount();
    fireEvent.click(await screen.findByRole("button", { name: /New Product/ }));
    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Example Author Product" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
      name: "Example Author Product",
      tags: [],
      tech_stack: [],
      search_keywords: [],
      features: [],
    });
    expect(calls.find((call) => call.method === "POST")?.body).not.toHaveProperty("visible");
    expect(calls.find((call) => call.method === "POST")?.body).not.toHaveProperty(
      "moderation_status",
    );
  });

  it("shows a real API failure and offers retry", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        return Response.json({ error: "Marketplace unavailable" }, { status: 502 });
      }),
    );

    mount();
    expect((await screen.findByRole("alert", {}, { timeout: 5_000 })).textContent).toContain(
      "Marketplace unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(attempts).toBeGreaterThan(2), { timeout: 5_000 });
  });

  it("shows only the actions allowed by each lifecycle state and submits through the API", async () => {
    const transitionRequests: Record<string, unknown>[] = [];
    const products = [
      ["draft-id", "Draft Product", "draft"],
      ["submitted-id", "Submitted Product", "submitted"],
      ["changes-id", "Changes Product", "changes_requested"],
      ["rejected-id", "Rejected Product", "rejected"],
      ["approved-id", "Approved Product", "approved"],
    ].map(([id, name, moderation_status]) => ({
      id,
      name,
      slug: String(name).toLowerCase().replaceAll(" ", "-"),
      category_id: null,
      price_label: null,
      moderation_status: String(moderation_status),
      content_status: "draft",
      updated_at: "2026-10-20T00:00:00Z",
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "GET") {
          return Response.json({ products, categories: [] });
        }
        transitionRequests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json({ ok: true, action: "submit" });
      }),
    );

    mount();

    const draftRow = await screen.findByRole("row", { name: /Draft Product/ });
    expect(within(draftRow).getByRole("button", { name: /Edit/ })).toBeTruthy();
    fireEvent.click(within(draftRow).getByRole("button", { name: /Submit/ }));
    await waitFor(() =>
      expect(transitionRequests).toContainEqual({ id: "draft-id", action: "submit" }),
    );

    const submittedRow = screen.getByRole("row", { name: /Submitted Product/ });
    expect(within(submittedRow).getByRole("button", { name: /Withdraw/ })).toBeTruthy();
    expect(within(submittedRow).queryByRole("button", { name: /Edit/ })).toBeNull();

    const changesRow = screen.getByRole("row", { name: /Changes Product/ });
    expect(within(changesRow).getByRole("button", { name: /Edit/ })).toBeTruthy();
    expect(within(changesRow).getByRole("button", { name: /Submit/ })).toBeTruthy();

    const rejectedRow = screen.getByRole("row", { name: /Rejected Product/ });
    expect(within(rejectedRow).getByRole("button", { name: /Edit/ })).toBeTruthy();
    expect(within(rejectedRow).getByRole("button", { name: /Return to draft/ })).toBeTruthy();
    expect(within(rejectedRow).queryByRole("button", { name: /Submit/ })).toBeNull();

    const approvedRow = screen.getByRole("row", { name: /Approved Product/ });
    expect(within(approvedRow).getByText("approved · read-only")).toBeTruthy();
    expect(within(approvedRow).queryByRole("button", { name: /Edit|Submit|Withdraw/ })).toBeNull();
  });

  it("validates the create form and serializes supported schema fields for the author API", async () => {
    const writes: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "GET") {
          return Response.json({ products: [], categories: [] });
        }
        writes.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json(
          { ok: true, created: true, product: { id: "new-product" } },
          { status: 201 },
        );
      }),
    );

    mount();
    fireEvent.click(await screen.findByRole("button", { name: /New Product/ }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "TestProduct" } });
    expect((await screen.findByRole("status")).textContent).toMatch(
      /remain hidden until reviewed/i,
    );
    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Author Product" },
    });
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "$25" } });
    fireEvent.change(screen.getByLabelText("Currency code"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("License"), { target: { value: "MIT" } });
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "analytics, reporting" },
    });
    fireEvent.change(screen.getByLabelText("Features (JSON)"), {
      target: { value: '["Audit history"]' },
    });
    fireEvent.change(screen.getByLabelText("Demo URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "demo_url must be an http(s) web address.",
    );
    expect(writes).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Demo URL"), {
      target: { value: "https://demo.example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      name: "Author Product",
      price_label: "$25",
      currency: "USD",
      license: "MIT",
      tags: ["analytics", "reporting"],
      features: ["Audit history"],
      demo_url: "https://demo.example.test",
    });
  });

  it("exposes every author-editable marketplace product field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ products: [], categories: [] })),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /New Product/ }));
    fireEvent.click(screen.getByText("Pricing and license"));
    fireEvent.click(screen.getByText("Images and links"));
    fireEvent.click(screen.getByText("Technology, features, and metadata"));

    const fields = [
      "Product name",
      "URL slug",
      "Description",
      "Industry",
      "Subcategory",
      "Category",
      "Software type",
      "Version",
      "Target audience",
      "Price",
      "Price period",
      "Currency code",
      "License",
      "Thumbnail URL",
      "Cover image URL",
      "Logo URL",
      "Icon URL or name",
      "Favicon URL",
      "Demo URL",
      "Public repository URL",
      "Technology",
      "Frontend",
      "Backend",
      "Database",
      "Mobile support",
      "Cloud support",
      "Languages",
      "Integrations",
      "Modules",
      "Benefits",
      "Roles",
      "Tags",
      "Technology stack",
      "Search keywords",
      "Features (JSON)",
    ];
    for (const field of fields) expect(screen.getByLabelText(field)).toBeTruthy();
  });
});
