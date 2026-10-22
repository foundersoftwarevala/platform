import { describe, expect, it } from "vitest";
import { chatFallbackRefetchInterval } from "./connection-policy";

describe("chat fallback polling policy", () => {
  it.each(["connecting", "reconnecting", "offline"] as const)(
    "polls while the notification stream is %s",
    (connection) => {
      expect(chatFallbackRefetchInterval(true, connection, 30_000)).toBe(30_000);
    },
  );

  it("stops fallback polling while live or when the query is disabled", () => {
    expect(chatFallbackRefetchInterval(true, "live", 30_000)).toBe(false);
    expect(chatFallbackRefetchInterval(false, "offline", 30_000)).toBe(false);
  });
});
