import { afterEach, describe, expect, it, vi } from "vitest";
import { moduleFetch } from "./fetch";

afterEach(() => vi.unstubAllGlobals());

describe("platform-compatible module requests", () => {
  it.each(["sb_secret_fixture", "sb_publishable_fixture"])(
    "does not send opaque %s as a bearer JWT",
    async (key) => {
      const send = vi.fn().mockResolvedValue(new Response("{}"));
      vi.stubGlobal("fetch", send);
      await moduleFetch(key)("https://database.example.invalid/rest/v1/rnd_ideas", {
        headers: { Authorization: `Bearer ${key}`, "X-Request-Id": "request" },
      });
      const headers = send.mock.calls[0][1].headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
      expect(headers.get("apikey")).toBe(key);
      expect(headers.get("X-Request-Id")).toBe("request");
    },
  );

  it("preserves the actual Control Panel user JWT and Request headers", async () => {
    const send = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", send);
    await moduleFetch("sb_publishable_fixture")(
      new Request("https://database.example.invalid/rest/v1/rnd_ideas", {
        headers: { Authorization: "Bearer user-session-fixture", "X-Request-Id": "request" },
      }),
      { headers: { Accept: "application/json" } },
    );
    const headers = send.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer user-session-fixture");
    expect(headers.get("X-Request-Id")).toBe("request");
    expect(headers.get("Accept")).toBe("application/json");
  });
});
