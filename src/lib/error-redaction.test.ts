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

  it("redacts email addresses and formatted or unformatted phone numbers in error text", () => {
    expect(
      redactSensitiveText(
        "Contact support at customer@example.com or +1 (415) 555-2671; callback 415-555-2671 or 4155552671.",
      ),
    ).toBe(
      "Contact support at [REDACTED_EMAIL] or [REDACTED_PHONE]; callback [REDACTED_PHONE] or [REDACTED_PHONE].",
    );
  });
});
