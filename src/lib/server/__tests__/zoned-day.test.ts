import { describe, expect, it } from "vitest";
import { validZone, zonedBoundaries } from "../zoned-day";

describe("zonedBoundaries", () => {
  it("starts an Indian day at 18:30 UTC the evening before", () => {
    // 01:00 IST on 2 October is 19:30 UTC on 1 October.
    const now = new Date("2026-10-01T19:30:00Z");
    const { startOfDay, startOfMonth } = zonedBoundaries("Asia/Kolkata", now);
    expect(startOfDay).toBe("2026-10-01T18:30:00.000Z");
    expect(startOfMonth).toBe("2026-09-30T18:30:00.000Z");
  });

  it("is plain midnight for UTC", () => {
    const { startOfDay } = zonedBoundaries("UTC", new Date("2026-10-02T12:00:00Z"));
    expect(startOfDay).toBe("2026-10-02T00:00:00.000Z");
  });

  it("follows a zone behind UTC, across daylight saving", () => {
    // Los Angeles is UTC-7 in October (PDT).
    const { startOfDay } = zonedBoundaries("America/Los_Angeles", new Date("2026-10-02T12:00:00Z"));
    expect(startOfDay).toBe("2026-10-02T07:00:00.000Z");
    // and UTC-8 in December (PST).
    const winter = zonedBoundaries("America/Los_Angeles", new Date("2026-12-02T12:00:00Z"));
    expect(winter.startOfDay).toBe("2026-12-02T08:00:00.000Z");
  });

  it("handles the day the clocks change", () => {
    // Clocks go forward in New York at 02:00 on 8 March 2026; midnight is still EST.
    const { startOfDay } = zonedBoundaries("America/New_York", new Date("2026-03-08T15:00:00Z"));
    expect(startOfDay).toBe("2026-03-08T05:00:00.000Z");
  });
});

describe("validZone", () => {
  it("keeps a real zone and replaces a made-up one", () => {
    expect(validZone("Europe/London")).toBe("Europe/London");
    expect(validZone("Foo/Bar")).toBe("Asia/Kolkata");
    expect(validZone("")).toBe("Asia/Kolkata");
    expect(validZone(null)).toBe("Asia/Kolkata");
  });
});
