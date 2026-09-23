import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

/**
 * Fetching an address someone typed into the Demo Manager.
 *
 * The server is inside a network with a database, a translation engine and
 * cloud metadata endpoints, so "fetch this URL" must not become "fetch
 * anything this server can reach". Checks, in order:
 *
 *   - http or https only, no user:password@, only the default ports;
 *   - the host name is not a local or internal name;
 *   - every address the name resolves to is public - checked inside the
 *     connection's own DNS lookup, so the address that is checked is the one
 *     that is connected to (no second lookup to swap it out);
 *   - redirects are followed by hand, and each hop is checked again;
 *   - a time limit and a size limit.
 */

export class UnsafeUrlError extends Error {}

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

function ipv4Blocked(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Blocked(ip: string): boolean {
  const v = ip.toLowerCase().split("%")[0];
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  return (
    v === "::" ||
    v === "::1" ||
    v.startsWith("::ffff:") ||
    v.startsWith("64:ff9b:") ||
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    /^fe[89ab]/.test(v) ||
    v.startsWith("ff") ||
    v.startsWith("2001:db8") ||
    v.startsWith("2001:0db8")
  );
}

export function addressBlocked(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return ipv4Blocked(ip);
  if (family === 6) return ipv6Blocked(ip);
  return true;
}

/** Parses and checks an address without touching the network. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    throw new UnsafeUrlError("That is not a valid web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only http and https addresses can be used.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Addresses with a user name or password are not accepted.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Only the standard web ports (80 and 443) are allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_NAMES.test(host) || !host.includes(".") && !net.isIP(host)) {
    throw new UnsafeUrlError("That address points to a local or internal host.");
  }
  if (net.isIP(host) && addressBlocked(host)) {
    throw new UnsafeUrlError("That address points to a private network.");
  }
  return url;
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

/** DNS lookup that refuses to connect to anything but public addresses. */
function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => addressBlocked(a.address))) {
      const refused = new UnsafeUrlError(
        `${hostname} resolves to a private or reserved address.`,
      ) as NodeJS.ErrnoException;
      refused.code = "EUNSAFEADDR";
      return callback(refused, "");
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export type FetchedPage = {
  url: string;
  status: number;
  contentType: string;
  body: string;
  redirects: string[];
};

function requestOnce(url: URL, maxBytes: number, timeoutMs: number) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>(
    (resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      const req = client.request(
        url,
        {
          method: "GET",
          lookup: guardedLookup as unknown as typeof dns.lookup,
          headers: {
            "User-Agent": "SoftwareVala-DemoManager/1.0 (+https://softwarevala.net)",
            Accept: "text/html,application/xhtml+xml,application/javascript,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              req.destroy(new UnsafeUrlError(`The response is larger than ${maxBytes} bytes.`));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => {
            let body = Buffer.concat(chunks);
            try {
              const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
              if (encoding.includes("gzip")) body = zlib.gunzipSync(body);
              else if (encoding.includes("br")) body = zlib.brotliDecompressSync(body);
              else if (encoding.includes("deflate")) body = zlib.inflateSync(body);
            } catch (error) {
              return reject(error);
            }
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
          });
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error(`No answer within ${timeoutMs / 1000} s.`)));
      req.on("error", reject);
      req.end();
    },
  );
}

/** GET an operator-supplied address with every check above. */
export async function safeFetch(
  raw: string,
  options: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<FetchedPage> {
  const maxBytes = options.maxBytes ?? 3_000_000;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRedirects = options.maxRedirects ?? 5;
  let url = assertPublicUrl(raw);
  const redirects: string[] = [];
  for (let hop = 0; ; hop++) {
    const res = await requestOnce(url, maxBytes, timeoutMs);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= maxRedirects) throw new UnsafeUrlError("Too many redirects.");
      url = assertPublicUrl(new URL(location, url).toString());
      redirects.push(url.toString());
      continue;
    }
    return {
      url: url.toString(),
      status: res.status,
      contentType: String(res.headers["content-type"] ?? ""),
      body: res.body.toString("utf8"),
      redirects,
    };
  }
}

/** Resolves a host and confirms every address is public (for the proxy). */
const hostVerdicts = new Map<string, { at: number; ok: boolean }>();
export async function hostIsPublic(hostname: string): Promise<boolean> {
  const cached = hostVerdicts.get(hostname);
  if (cached && Date.now() - cached.at < 300_000) return cached.ok;
  let ok = false;
  try {
    assertPublicUrl(`https://${hostname}/`);
    const list = await dns.promises.lookup(hostname, { all: true });
    ok = list.length > 0 && !list.some((a) => addressBlocked(a.address));
  } catch {
    ok = false;
  }
  hostVerdicts.set(hostname, { at: Date.now(), ok });
  return ok;
}
