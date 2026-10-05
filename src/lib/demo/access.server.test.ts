import { afterEach, expect, it, vi } from "vitest";
import { getDemoAccessDetails } from "./access.server";

afterEach(() => vi.unstubAllEnvs());

it("does not provide credentials when unconfigured", () => {
  vi.stubEnv("DEMO_ACCESS_DETAILS", "");
  expect(getDemoAccessDetails()).toBeUndefined();
});

it("returns only configured demo access fields", () => {
  const fields = {
    username: "test-user",
    password: "test-password",
    licenseKey: "test-license",
    backupKey: "test-backup",
  };
  vi.stubEnv("DEMO_ACCESS_DETAILS", JSON.stringify({ ...fields, extra: "excluded" }));
  expect(getDemoAccessDetails()).toEqual(fields);
});

it.each([
  "invalid json",
  "null",
  "{}",
  '{"username":4}',
  '{"username":"x","password":"","licenseKey":"x","backupKey":"x"}',
])("rejects invalid configuration without exposing its values: %s", (value) => {
  vi.stubEnv("DEMO_ACCESS_DETAILS", value);
  expect(() => getDemoAccessDetails()).toThrow();
});
