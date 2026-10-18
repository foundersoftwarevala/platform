import { safeFetch } from "@/lib/demo/safe-fetch.server";

export const SLOW_MS = 2500;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export type UrlCheck = {
  status: number;
  ms: number;
  result: "working" | "slow" | "offline";
  ssl_valid: boolean | null;
  ssl_days: number | null;
  error: string | null;
};

export async function checkUrl(raw: string): Promise<UrlCheck> {
  const started = Date.now();
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return {
      status: 0,
      ms: 0,
      result: "offline",
      ssl_valid: null,
      ssl_days: null,
      error: "Not a valid address",
    };
  }

  try {
    const page = await safeFetch(url.toString(), {
      maxBytes: 64_000,
      timeoutMs: TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
    });
    const ms = Date.now() - started;
    return {
      status: page.status,
      ms,
      result:
        page.status >= 200 && page.status < 400 ? (ms > SLOW_MS ? "slow" : "working") : "offline",
      ssl_valid: page.sslValid,
      ssl_days: page.sslDays,
      error: page.status >= 400 ? `HTTP ${page.status}` : null,
    };
  } catch (cause) {
    return {
      status: 0,
      ms: Date.now() - started,
      result: "offline",
      ssl_valid: null,
      ssl_days: null,
      error: (cause instanceof Error ? cause.message : String(cause)).slice(0, 300),
    };
  }
}
