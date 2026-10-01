/**
 * A "?redirect=" value that is safe to follow after signing in: a path on this
 * site and nothing else.
 *
 * Checking only for a leading "/" and no "//" let "/\evil.com" through, which
 * browsers read as "//evil.com" - another site. The value is resolved the way
 * the browser would resolve it and kept only if it stays on this origin.
 */
export function internalPath(asked: string | null | undefined): string | undefined {
  const value = String(asked ?? "");
  if (!value.startsWith("/") || /[\\\u0000-\u001f]/.test(value) || value.startsWith("//")) {
    return undefined;
  }
  try {
    const base = "https://internal.invalid";
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return undefined;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return undefined;
  }
}
