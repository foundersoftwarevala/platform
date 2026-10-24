import { describe, expect, it } from "vitest";
import { redactErrorMetadata, redactSensitiveData, redactSensitiveText } from "./error-redaction";

describe("error data redaction", () => {
  it("redacts credential assignments, bearer tokens, and sensitive object keys", () => {
    const redacted = redactSensitiveData({
      message: 'request failed: api_key="key-value", password: secret phrase',
      authorization: "Bearer user-token",
      details: { access_token: "nested-token", action: "refresh" },
    });

    expect(redacted).toEqual({
      message: 'request failed: api_key="[REDACTED]", password: [REDACTED]',
      details: { action: "refresh" },
    });
    expect(redactSensitiveText("Authorization: Bearer sensitive-value")).toBe(
      "Authorization: [REDACTED]",
    );
  });

  it("persists only allowlisted error metadata", () => {
    expect(
      redactErrorMetadata({
        kind: "boundary",
        reported_severity: "error",
        token: "do-not-store",
        custom: "not allowlisted",
      }),
    ).toEqual({ kind: "boundary", reported_severity: "error" });
  });
});
