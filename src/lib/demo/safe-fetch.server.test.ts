import { describe, expect, it, vi } from "vitest";
import dns from "node:dns";
import zlib from "node:zlib";
import { decompressBody, safeFetchResponse } from "./safe-fetch.server";

describe("decompressBody", () => {
  it("limits decompressed response size", () => {
    const compressed = zlib.gzipSync(Buffer.alloc(256_000));

    expect(compressed.length).toBeLessThan(64_000);
    expect(() => decompressBody(compressed, "gzip", 64_000)).toThrow();
  });

  it("keeps responses within the decompressed limit", () => {
    const body = Buffer.from("safe response");
    const compressed = zlib.gzipSync(body);

    expect(decompressBody(compressed, "gzip", 64_000)).toEqual(body);
  });
});

describe("safeFetchResponse", () => {
  it("rejects a hostname that resolves to a private address in the request lookup", async () => {
    const lookup = vi.spyOn(dns, "lookup").mockImplementation((hostname, options, callback) => {
      const done = typeof options === "function" ? options : callback;
      if (typeof done === "function") {
        done(null, [{ address: "127.0.0.1", family: 4 }]);
      }
      return undefined;
    });

    await expect(safeFetchResponse("https://public.example.test")).rejects.toThrow(
      "resolves to a private or reserved address",
    );
    expect(lookup).toHaveBeenCalledOnce();
    lookup.mockRestore();
  });
});
