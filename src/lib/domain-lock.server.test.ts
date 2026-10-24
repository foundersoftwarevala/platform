import { describe, expect, it } from "vitest";
import { isAllowedDomainRequest } from "./domain-lock.server";

describe("domain lock", () => {
  it("allows the canonical domain with absent or matching origin", () => {
    expect(isAllowedDomainRequest("softwarevala.net", null, "production")).toBe(true);
    expect(
      isAllowedDomainRequest("softwarevala.net", "https://softwarevala.net", "production"),
    ).toBe(true);
  });

  it("rejects alternate hosts and cross-origin requests", () => {
    expect(isAllowedDomainRequest("attacker.test", null, "production")).toBe(false);
    expect(isAllowedDomainRequest("softwarevala.net", "https://attacker.test", "production")).toBe(
      false,
    );
    expect(isAllowedDomainRequest("softwarevala.net", "null", "production")).toBe(false);
  });

  it("allows localhost development hosts only outside production", () => {
    expect(isAllowedDomainRequest("localhost:3000", "http://localhost:3000", "development")).toBe(
      true,
    );
    expect(isAllowedDomainRequest("127.0.0.1:3000", null, "test")).toBe(true);
    expect(isAllowedDomainRequest("localhost:3000", null, "production")).toBe(false);
  });

  it("rejects malformed host and origin values", () => {
    expect(isAllowedDomainRequest(undefined, null, "production")).toBe(false);
    expect(isAllowedDomainRequest("softwarevala.net/attacker", null, "production")).toBe(false);
    expect(
      isAllowedDomainRequest("softwarevala.net", "https://softwarevala.net.attacker", "production"),
    ).toBe(false);
  });
});
