import { describe, expect, it } from "vitest";
import { alertNeedsAction, domainChecks } from "../demo-ops";

const demo = { url: "https://demo.example.test", http_status: 200, last_health_check: null };
const mapping = (domain?: { hostname: string; status: string } | null) =>
  domainChecks(demo, domain).find((check) => check.id === "domain-mapping");

describe("demo schema contracts", () => {
  it("uses the real resolution flag for action-needed and active-alert state", () => {
    expect(alertNeedsAction({ is_resolved: false })).toBe(true);
    expect(alertNeedsAction({ is_resolved: true })).toBe(false);
    expect([{ is_resolved: true }, { is_resolved: false }].filter(alertNeedsAction)).toHaveLength(
      1,
    );
  });

  it("reports a live matching domain without inventing a locked flag", () => {
    expect(mapping({ hostname: "demo.example.test", status: "live" })).toMatchObject({
      state: "pass",
      detail: "Mapped domain: demo.example.test (live)",
      source: "demo_domains.hostname / demos.url",
    });
  });

  it("does not treat an unprovisioned hostname as live", () => {
    expect(mapping({ hostname: "demo.example.test", status: "dns_pending" })?.state).toBe("warn");
  });

  it("does not associate a different hostname with the demo", () => {
    expect(mapping({ hostname: "other.example.test", status: "live" })?.detail).toBe(
      "Custom domain in use: demo.example.test",
    );
  });

  it("preserves shared-host warnings and unparseable-URL failures", () => {
    const shared = { ...demo, url: "https://fixture.lovable.app" };
    expect(domainChecks(shared).find((check) => check.id === "domain-mapping")?.state).toBe("warn");
    expect(
      domainChecks({ ...demo, url: "not a URL" }).find((check) => check.id === "https")?.state,
    ).toBe("fail");
  });
});
