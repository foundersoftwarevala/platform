import { describe, expect, it } from "vitest";

import { engineBackoffSeconds } from "../../language-catalog";

describe("waiting for a busy translation engine", () => {
  it("backs off 15 s, 30 s, 60 s, 120 s, 240 s, then every five minutes", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(engineBackoffSeconds)).toEqual([
      15, 30, 60, 120, 240, 300, 300,
    ]);
  });

  it("never waits less than 15 s", () => {
    expect(engineBackoffSeconds(0)).toBe(15);
  });
});
