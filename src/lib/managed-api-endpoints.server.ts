const BUILT_IN_PROVIDER_HOSTS = new Set([
  "analyticsdata.googleapis.com",
  "api.anthropic.com",
  "api.github.com",
  "api.indexnow.org",
  "api.linkedin.com",
  "api.openai.com",
  "api.pinterest.com",
  "api.search.brave.com",
  "api.webmaster.yandex.net",
  "api.x.com",
  "graph.facebook.com",
  "mybusinessbusinessinformation.googleapis.com",
  "oauth.reddit.com",
  "open.tiktokapis.com",
  "openapi.naver.com",
  "searchconsole.googleapis.com",
  "ssl.bing.com",
  "www.googleapis.com",
  "ziyuan.baidu.com",
  "generativelanguage.googleapis.com",
]);

function configuredProviderHosts(): Set<string> {
  return new Set(
    (process.env.AI_API_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => /^[a-z0-9.-]+$/.test(host)),
  );
}

function isPrivateAddress(hostname: string): boolean {
  return /^(?:localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[0-1])\.|::1|fc|fd|fe80:)/i.test(
    hostname,
  );
}

/**
 * A database row must never turn the server into a credential-forwarding proxy.
 * New hosts require an explicit server-side `AI_API_ALLOWED_HOSTS` deployment
 * setting; manager UI changes alone cannot add a destination for a secret.
 */
export function assertManagedProviderEndpoint(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("A managed provider requires a valid HTTPS endpoint.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A managed provider requires a valid HTTPS endpoint.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    isPrivateAddress(hostname) ||
    !(BUILT_IN_PROVIDER_HOSTS.has(hostname) || configuredProviderHosts().has(hostname))
  ) {
    throw new Error(
      "Provider endpoint is not allowlisted. Add its hostname to AI_API_ALLOWED_HOSTS in server configuration before registering it.",
    );
  }
  return url;
}
