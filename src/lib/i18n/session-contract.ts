export const LANGUAGE_SESSION_COOKIE = "__Host-sv_language_session";
export const LANGUAGE_SESSION_CHANGE_EVENT = "sv:language-session-change";

export function languageAuthorization(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header) return header;
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANGUAGE_SESSION_COOKIE}=`))
    ?.slice(LANGUAGE_SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? `Bearer ${token}` : null;
}

/** Cookie-authenticated mutations require an explicit same-origin caller. */
export function sameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // The trusted public edge terminates TLS; nginx preserves this host over HTTP.
  // Never derive an allowed origin from arbitrary forwarded headers.
  if (["softwarevala.net", "www.softwarevala.net"].includes(url.hostname))
    return origin === `https://${url.hostname}`;
  return origin === url.origin;
}
