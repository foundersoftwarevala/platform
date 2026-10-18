import { describe, expect, expectTypeOf, it } from "vitest";
import { isJson, requireJson, requireJsonObject, type Json, type JsonObject } from "../json";

describe("shared JSON wire contract", () => {
  it.each([
    { name: "null", value: null },
    { name: "false", value: false },
    { name: "zero", value: 0 },
    { name: "string", value: "fixture" },
    { name: "empty array", value: [] },
    { name: "empty object", value: {} },
    { name: "nested data", value: { rows: [{ count: 2, checks: [true, null] }] } },
    { name: "optional object field", value: { enabled: true, note: undefined } },
  ])("preserves $name without changing its shape", ({ value }) => {
    expect(isJson(value)).toBe(true);
    expect(requireJson(value, "Fixture response")).toBe(value);
  });

  it.each([
    { name: "undefined", value: undefined },
    { name: "function", value: () => "fixture" },
    { name: "symbol", value: Symbol("fixture") },
    { name: "bigint", value: 1n },
    { name: "NaN", value: NaN },
    { name: "infinity", value: Infinity },
    { name: "negative infinity", value: -Infinity },
    { name: "date", value: new Date("2026-01-01T00:00:00Z") },
    { name: "map", value: new Map([["key", "fixture"]]) },
    { name: "set", value: new Set(["fixture"]) },
    { name: "undefined array element", value: [undefined] },
    { name: "sparse array", value: Array(1) },
    { name: "nested function", value: { rows: [{ value: () => null }] } },
  ])("rejects $name rather than silently converting it", ({ value }) => {
    expect(isJson(value)).toBe(false);
    expect(() => requireJson(value, "Fixture response")).toThrow(
      "Fixture response is not JSON serializable",
    );
  });

  it("rejects cycles but accepts repeated references that are not cycles", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isJson(cyclic)).toBe(false);
    expect(() => requireJson(cyclic, "Fixture response")).toThrow(
      "Fixture response is not JSON serializable",
    );
    const row = { id: "fixture" };
    expect(isJson({ before: row, after: row })).toBe(true);
  });

  it("accepts JSON objects with a null prototype", () => {
    const value = Object.assign(Object.create(null), { ok: true });
    expect(requireJsonObject(value, "Fixture response")).toBe(value);
  });

  it.each([null, false, 0, "fixture", []].map((value) => ({ value })))(
    "refuses non-object $value when an RPC promises an object",
    ({ value }) => {
      expect(() => requireJsonObject(value, "Fixture response")).toThrow(
        "Fixture response must be a JSON object",
      );
    },
  );

  it("keeps object contracts serializable without accepting unknown fields", () => {
    expectTypeOf<JsonObject>().toExtend<Json>();
    expectTypeOf<{ payload: unknown }>().not.toExtend<Json>();
    expectTypeOf<{ rows: Json[]; note?: string }>().toExtend<Json>();
  });
});
