// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { countOverduePromises, useTicker } from "./usePromiseTracker";

const BASE = Date.parse("2026-10-28T00:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Promise Tracker ticker", () => {
  it("updates overdue metrics after a deadline without promise data changing", () => {
    const promises = [{ status: "active", deadline: new Date(BASE + 30_000).toISOString() }];
    const { result } = renderHook(() => {
      const now = useTicker(30_000);
      return countOverduePromises(promises, now.getTime());
    });

    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(1);
  });
});
