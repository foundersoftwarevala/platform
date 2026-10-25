const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Search Console OAuth requires GOOGLE_SEARCH_CONSOLE_CLIENT_ID and GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET.",
    );
  }
  if (!refreshToken.trim()) throw new Error("Google Search Console refresh token is empty.");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token refresh failed (HTTP ${response.status}).`);
  }
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string" ||
    !payload.access_token
  ) {
    throw new Error("Google OAuth token refresh returned no access token.");
  }
  return payload.access_token;
}
