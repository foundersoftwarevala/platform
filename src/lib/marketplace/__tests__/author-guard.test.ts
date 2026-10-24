import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthorBackendError, ownsProduct, readAllRows, requireAuthor } from "../author-guard";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const request = (authorization = "Bearer valid-token") =>
  new Request("https://softwarevala.net/api/author/products", {
    headers: authorization ? { authorization } : {},
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("author identity and ownership lookups", () => {
  it("keeps invalid credentials distinct from authentication service failures", async () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "fixture-anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "invalid token" }, 401)),
    );

    const result = await requireAuthor(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns an explicit gateway error when Auth cannot verify the caller", async () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "fixture-anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "unavailable" }, 503)),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await requireAuthor(request());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(502);
      expect(await result.response.json()).toMatchObject({
        error: "Could not verify your sign-in",
      });
    }
  });

  it("does not turn a failed seller lookup into an unregistered-author response", async () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "fixture-anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) =>
        String(input).endsWith("/auth/v1/user")
          ? json({ id: "user-1", email: "author@example.test" })
          : json({ message: "unavailable" }, 503),
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await requireAuthor(request());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(502);
      expect(await result.response.json()).toMatchObject({
        error: "Could not verify your author account",
      });
    }
  });

  it("does not turn a failed ownership query into a non-owner result", async () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "unavailable" }, 503)),
    );

    await expect(ownsProduct("seller-1", "product-1")).rejects.toMatchObject({
      name: "AuthorBackendError",
      message: "Product ownership lookup failed (503)",
    } satisfies Partial<AuthorBackendError>);
  });

  it("reads every exact-count page in stable query order", async () => {
    vi.stubEnv("SUPABASE_URL", "http://db.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
    const fetchMock = vi.fn(async (input: string | URL) => {
      const offset = new URL(String(input)).searchParams.get("offset");
      return offset === "0"
        ? Response.json([{ id: "row-1" }, { id: "row-2" }], {
            headers: { "content-range": "0-1/3" },
          })
        : Response.json([{ id: "row-3" }], {
            headers: { "content-range": "2-2/3" },
          });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await readAllRows<{ id: string }>(
      "marketplace_products?select=id&order=id.asc",
      "Product read",
    );

    expect(rows.map((row) => row.id)).toEqual(["row-1", "row-2", "row-3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("offset=2");
  });
});
