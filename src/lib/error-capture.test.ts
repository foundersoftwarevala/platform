import { describe, expect, it } from "vitest";
import {
  captureRequestError,
  consumeCapturedError,
  withRequestErrorContext,
} from "./error-capture";

describe("request-scoped SSR error capture", () => {
  it("keeps errors isolated across overlapping requests", async () => {
    const firstContext = {};
    const secondContext = {};
    const firstError = new Error("first request");
    const secondError = new Error("second request");

    const [first, second] = await Promise.all([
      withRequestErrorContext(firstContext, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        captureRequestError(firstError);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return consumeCapturedError(firstContext);
      }),
      withRequestErrorContext(secondContext, async () => {
        captureRequestError(secondError);
        await new Promise((resolve) => setTimeout(resolve, 8));
        return consumeCapturedError(secondContext);
      }),
    ]);

    expect(first).toBe(firstError);
    expect(second).toBe(secondError);
    expect(consumeCapturedError(firstContext)).toBeUndefined();
    expect(consumeCapturedError(secondContext)).toBeUndefined();
  });
});
