import { describe, expect, it } from "vitest";
import { initialDemoPath } from "./entry-path";

describe("initial demo entry paths", () => {
  it("opens the church community app at its working auth route", () => {
    expect(initialDemoPath("church-community-operations", "/", true)).toBe("/auth");
  });

  it("leaves other demos and subsequent in-app root requests unchanged", () => {
    expect(initialDemoPath("school-management", "/", true)).toBeNull();
    expect(initialDemoPath("church-community-operations", "/", false)).toBeNull();
    expect(initialDemoPath("church-community-operations", "/auth", true)).toBeNull();
  });
});
