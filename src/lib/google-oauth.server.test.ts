import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshGoogleAccessToken } from "./google-oauth.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Google OAuth token refresh", () => {
  it("exchanges a refresh token for an access token", async () => {
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID", "client-id-fixture");
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET", "client-secret-fixture");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("refresh_token")).toBe("refresh-token-fixture");
      expect(body.get("grant_type")).toBe("refresh_token");
      return Response.json({ access_token: "access-token-fixture" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshGoogleAccessToken("refresh-token-fixture")).resolves.toBe(
      "access-token-fixture",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails explicitly when the OAuth client configuration is missing", async () => {
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET", "");

    await expect(refreshGoogleAccessToken("refresh-token-fixture")).rejects.toThrow(
      "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
    );
  });

  it("rejects an unsuccessful or malformed token response", async () => {
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID", "client-id-fixture");
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET", "client-secret-fixture");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 200 })));

    await expect(refreshGoogleAccessToken("refresh-token-fixture")).rejects.toThrow(
      "returned no access token",
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(refreshGoogleAccessToken("refresh-token-fixture")).rejects.toThrow("HTTP 401");
  });
});
