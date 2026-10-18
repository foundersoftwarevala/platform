import { describe, expect, it } from "vitest";
import { demoFirst } from "./demo-first";

describe("demo-first row ordering", () => {
  it("promotes demos without changing order inside either group", () => {
    const values = [1, 2, 3, 4, 5, 6];
    expect(demoFirst(values, (value) => value === 3 || value === 6)).toEqual([3, 6, 1, 2, 4, 5]);
    expect(values).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("leaves rows with no demos or only demos unchanged", () => {
    expect(demoFirst([1, 2], () => false)).toEqual([1, 2]);
    expect(demoFirst([1, 2], () => true)).toEqual([1, 2]);
    expect(demoFirst([], () => true)).toEqual([]);
  });

  it("ranks before paging without losing or repeating any of 12000 entries", () => {
    const values = Array.from({ length: 12000 }, (_, index) => index);
    const ordered = demoFirst(values, (value) => value === 11999 || value === 7000);
    expect(ordered.slice(0, 12)).toEqual([7000, 11999, ...values.slice(0, 10)]);
    const pages = Array.from({ length: 24 }, (_, index) =>
      ordered.slice(index * 500, (index + 1) * 500),
    );
    expect(pages.every((page) => page.length === 500)).toBe(true);
    expect(pages.flat()).toEqual(ordered);
    expect(new Set(pages.flat()).size).toBe(12000);
    expect([...ordered].sort((a, b) => a - b)).toEqual(values);
  });
});
