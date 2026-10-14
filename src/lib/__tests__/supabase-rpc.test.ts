import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Json } from "../json";

const mocks = vi.hoisted(() => ({
  header: vi.fn<(name: string) => string | undefined>(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: mocks.header }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { callAsUser, createUserClient } from "../supabase-rpc.server";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://database.fixture.test");
  vi.stubEnv("SUPABASE_ANON_KEY", "fixture-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key-must-not-be-used");
  mocks.header.mockReturnValue("Bearer fixture-user-token");
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("caller-scoped RPC serialization boundary", () => {
  it("preserves nested response data and forwards arguments without reshaping", async () => {
    const data = { ok: true, rows: [{ id: "fixture", checks: [null, true, 0] }] };
    const args = { p_query: { limit: 25, search: undefined } };
    mocks.rpc.mockResolvedValue({ data, error: null });

    const result = await callAsUser<typeof data>("mm_fixture", args);

    expect(result).toBe(data);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("mm_fixture", args);
    expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith(
      "https://database.fixture.test",
      "fixture-anon-key",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: "Bearer fixture-user-token" } },
      },
    );
    expectTypeOf(result).toEqualTypeOf<typeof data>();
  });

  it.each([undefined, "Basic fixture", "bearer fixture", "Bearer "])(
    "refuses missing or invalid bearer authorization %j before creating a client",
    async (header) => {
      mocks.header.mockReturnValue(header);
      await expect(callAsUser("mm_fixture", {})).rejects.toThrow("Unauthorized: sign in required");
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("preserves the uppercase request-header fallback", async () => {
    mocks.header.mockImplementation((name) =>
      name === "Authorization" ? "Bearer fixture-user-token" : undefined,
    );
    await createUserClient();
    expect(mocks.header.mock.calls).toEqual([["authorization"], ["Authorization"]]);
    expect(mocks.createClient.mock.calls[0]?.[2].global.headers.Authorization).toBe(
      "Bearer fixture-user-token",
    );
  });

  it("keeps the publishable URL/key fallback and never uses the service key", async () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_ANON_KEY", undefined);
    vi.stubEnv("VITE_SUPABASE_URL", "https://fallback.fixture.test");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fixture-publishable-key");
    await createUserClient();
    expect(mocks.createClient.mock.calls[0]?.slice(0, 2)).toEqual([
      "https://fallback.fixture.test",
      "fixture-publishable-key",
    ]);
  });

  it("allows anonymous topbar reads only through the explicit opt-in", async () => {
    mocks.header.mockReturnValue(undefined);
    const data = [{ module_key: "login", live: true, config: {} }];
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await callAsUser<typeof data>("mm_topbar_modules", {}, { allowAnonymous: true })).toBe(
      data,
    );
    expect(mocks.createClient.mock.calls[0]?.[2].global).toBeUndefined();
  });

  it("still forwards a signed-in caller token when anonymous access is permitted", async () => {
    await callAsUser("mm_topbar_modules", {}, { allowAnonymous: true });
    expect(mocks.createClient.mock.calls[0]?.[2].global.headers.Authorization).toBe(
      "Bearer fixture-user-token",
    );
  });

  it("propagates database refusals without turning them into empty success", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "not_permitted" } });
    await expect(callAsUser("mm_fixture", {})).rejects.toThrow("not_permitted");
  });

  it("propagates transport failures unchanged", async () => {
    const failure = new Error("Fixture transport failure");
    mocks.rpc.mockRejectedValue(failure);
    await expect(callAsUser("mm_fixture", {})).rejects.toBe(failure);
  });

  it("rejects a non-JSON argument before making an RPC request", async () => {
    await expect(callAsUser("mm_fixture", { p_query: new Map() })).rejects.toThrow(
      "RPC mm_fixture arguments is not JSON serializable",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects non-serializable responses with explicit RPC context", async () => {
    mocks.rpc.mockResolvedValue({ data: { rows: [undefined] }, error: null });
    await expect(callAsUser("mm_fixture", {})).rejects.toThrow(
      "RPC mm_fixture response is not JSON serializable",
    );
  });

  it.each([null, false, 0, "fixture", []].map((data) => ({ data })))(
    "preserves valid JSON response $data",
    async ({ data }) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      expect(await callAsUser<Json>("mm_fixture", {})).toBe(data);
    },
  );
});
