import { isIP } from "node:net";

export type AyraOllamaEndpoint = {
  url: string;
  headers: Record<string, string>;
};

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  const version = isIP(host);
  if (version === 4) {
    const octets = host.split(".").map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }
  if (version === 6) return host === "::1" || host.startsWith("fc") || host.startsWith("fd");
  return false;
}

export function resolveAyraOllamaEndpoint(
  configuredUrl: string | undefined,
  defaultEndpoint: string,
  accessClientId?: string,
  accessClientSecret?: string,
): AyraOllamaEndpoint {
  const configured = configuredUrl?.trim();
  if (!configured) return { url: defaultEndpoint, headers: {} };

  let endpoint: URL;
  try {
    endpoint = new URL(configured);
  } catch {
    throw new Error("AYRA_OLLAMA_URL must be a valid HTTPS URL or private-network HTTP URL.");
  }

  const privateAddress = isPrivateAddress(endpoint.hostname);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol !== "https:" &&
      !(endpoint.protocol === "http:" && privateAddress))
  ) {
    throw new Error("AYRA_OLLAMA_URL must use HTTPS or a private-network HTTP address.");
  }

  const clientId = accessClientId?.trim();
  const clientSecret = accessClientSecret?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error(
      "Configure both AYRA_OLLAMA_ACCESS_CLIENT_ID and AYRA_OLLAMA_ACCESS_CLIENT_SECRET.",
    );
  }
  if (!privateAddress && (!clientId || !clientSecret)) {
    throw new Error("Remote Ollama endpoints require Cloudflare Access client credentials.");
  }
  if ((clientId || clientSecret) && endpoint.protocol !== "https:") {
    throw new Error("Cloudflare Access credentials may be sent only to an HTTPS Ollama URL.");
  }

  const path = endpoint.pathname.replace(/\/+$/, "");
  endpoint.pathname = path.endsWith("/v1/chat/completions")
    ? path
    : `${path}/v1/chat/completions`;

  const headers: Record<string, string> = {};
  if (clientId && clientSecret) {
    headers["CF-Access-Client-Id"] = clientId;
    headers["CF-Access-Client-Secret"] = clientSecret;
  }
  return { url: endpoint.toString(), headers };
}
