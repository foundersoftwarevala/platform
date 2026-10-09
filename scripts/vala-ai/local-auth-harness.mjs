/**
 * LOCAL TEST HARNESS ONLY — never deployed, never referenced by application code.
 *
 * The platform shell and the Control Panel login need the platform's auth
 * service, which a developer machine does not have. This answers the two
 * requests the login path makes — "whose token is this?" (/auth/v1/user) and
 * "which roles does that account hold?" (/rest/v1/user_roles) — for exactly
 * one token, so the real Vala AI code path (bearer token → requireOperator →
 * role mapping) can be driven in a browser on 127.0.0.1. Every other request
 * gets an empty answer.
 *
 *   node scripts/vala-ai/local-auth-harness.mjs --port 54321 --role boss_owner
 *
 * Start the dev server with VITE_SUPABASE_URL / SUPABASE_URL pointing here and
 * any non-secret strings as the keys; the e2e script seeds the browser session.
 */
import { createServer } from "node:http";

const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : f;
};
const PORT = Number(arg("port", "54321"));
const ROLE = arg("role", "boss_owner");
export const HARNESS_TOKEN = "local-harness-token";
const USER = {
  id: "00000000-0000-4000-8000-00000000a1a1",
  email: "harness-owner@local.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

createServer((req, res) => {
  res.setHeader("access-control-allow-origin", req.headers.origin ?? "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("content-type", "application/json");
  if (req.method === "OPTIONS") return res.end();
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const url = new URL(req.url ?? "/", "http://x");
  console.log(
    `${req.method} ${url.pathname}${url.search} token=${token === HARNESS_TOKEN ? "harness" : token ? "other" : "none"}`,
  );

  if (url.pathname === "/auth/v1/user") {
    if (token !== HARNESS_TOKEN) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ message: "invalid token" }));
    }
    return res.end(JSON.stringify(USER));
  }
  if (url.pathname === "/rest/v1/user_roles") {
    const forUser = url.searchParams.get("user_id") === `eq.${USER.id}`;
    return res.end(JSON.stringify(forUser ? [{ role: ROLE }] : []));
  }
  if (url.pathname.startsWith("/rest/v1/")) return res.end("[]");
  res.statusCode = 404;
  res.end(JSON.stringify({ message: "not provided by the local harness" }));
}).listen(PORT, "127.0.0.1", () =>
  console.log(`local auth harness on 127.0.0.1:${PORT}, role ${ROLE}`),
);
