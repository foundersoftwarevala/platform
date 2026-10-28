import { describe, expect, it } from "vitest";

import { cockpitLoadLabel } from "./cockpit";

describe("cockpitLoadLabel", () => {
  it("does not claim live while initial figures are loading", () => {
    expect(
      cockpitLoadLabel({
        isError: false,
        isLoading: true,
        isFetching: true,
        hasData: false,
      }),
    ).toBe("LOADING");
  });

  it("does not claim live after an error, even if cached data exists", () => {
    expect(
      cockpitLoadLabel({
        isError: true,
        isLoading: false,
        isFetching: false,
        hasData: true,
      }),
    ).toBe("UNAVAILABLE");
  });

  it("shows updating while refreshing existing figures", () => {
    expect(
      cockpitLoadLabel({
        isError: false,
        isLoading: false,
        isFetching: true,
        hasData: true,
      }),
    ).toBe("UPDATING");
  });

  it("shows live only for settled data", () => {
    expect(
      cockpitLoadLabel({
        isError: false,
        isLoading: false,
        isFetching: false,
        hasData: true,
      }),
    ).toBe("LIVE");
  });

  it("shows unavailable when no request or data is available", () => {
    expect(
      cockpitLoadLabel({
        isError: false,
        isLoading: false,
        isFetching: false,
        hasData: false,
      }),
    ).toBe("UNAVAILABLE");
  });
});
