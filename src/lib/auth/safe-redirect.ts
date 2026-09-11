/**
 * Where a visitor may be sent after signing in, when the address came from
 * the URL (`/login?redirect=...`).
 *
 * The check used to be a string test: it had to start with "/" and must not
 * start with "//". That let `/\evil.com` through, and browsers read a
 * backslash in that position as a slash, so `location.assign("/\evil.com")`
 * left the site for evil.com - an open redirect sitting on the sign-in page,
 * which is exactly where a phishing link wants one.
 *
 * The address is now resolved the way the browser will resolve it, against
 * this site's own origin, and accepted only if it is still on this site. What
 * comes back is the path, query and fragment of that resolved address, never
 * the raw string, so nothing the browser would reinterpret survives.
 */
export function safeRedirectPath(
  asked: string | null | undefined,
  origin: string | undefined = typeof window === "undefined" ? undefined : window.location.origin,
): string | undefined {
  if (!origin) return undefined;
  const value = String(asked ?? "").trim();
  // Only a path on this site is ever asked for; a full address, a scheme or
  // an empty value is refused before it is parsed at all.
  if (!value.startsWith("/")) return undefined;
  try {
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return undefined;
    // `/.//evil.com` resolves on this origin to the path `//evil.com`, which
    // location.assign would read as a protocol-relative address. A path that
    // begins with two slashes is therefore refused as well.
    if (resolved.pathname.startsWith("//")) return undefined;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return undefined;
  }
}
