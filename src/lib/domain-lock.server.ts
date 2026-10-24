const CANONICAL_HOST = "softwarevala.net";
const DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function normalizedHost(value: string | null | undefined): string | null {
  if (!value || value.length > 255 || /[\s/@\\]/.test(value)) return null;
  try {
    const parsed = new URL(`http://${value}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.host.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function allowedHostname(hostname: string, environment: string | undefined): boolean {
  if (hostname === CANONICAL_HOST) return true;
  return environment !== "production" && DEVELOPMENT_HOSTS.has(hostname);
}

export function isAllowedDomainRequest(
  hostHeader: string | null | undefined,
  originHeader: string | null | undefined,
  environment = process.env.NODE_ENV,
): boolean {
  const host = normalizedHost(hostHeader);
  if (!host) return false;

  let target: URL;
  try {
    target = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (!allowedHostname(target.hostname.toLowerCase(), environment)) return false;

  if (!originHeader) return true;
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }
  if (origin.protocol !== "https:" && origin.protocol !== "http:") return false;

  const normalizedOriginHost = normalizedHost(origin.host);
  if (normalizedOriginHost !== host) return false;
  return allowedHostname(origin.hostname.toLowerCase(), environment);
}
