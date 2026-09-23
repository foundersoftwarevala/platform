/**
 * Do the dashboard sign-ins actually work?
 *
 * Reads the addresses and passwords from .env.ops - never from the repository -
 * and asks Supabase for a session for each one, the same exchange the sign-in
 * page makes. Prints whether each was accepted and what role the account
 * carries, and never prints a password.
 *
 *   node scripts/ops/check-logins.mjs
 */
import { readFileSync } from "node:fs";

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

const ops = readEnv(".env.ops");
const app = readEnv(".env");
const url = ops.SUPABASE_URL ?? app.VITE_SUPABASE_URL;
const anon =
  app.VITE_SUPABASE_PUBLISHABLE_KEY ??
  app.VITE_SUPABASE_ANON_KEY ??
  ops.SUPABASE_ANON_KEY ??
  (ops.SUPABASE_PUBLISHABLE_KEY ?? ops.SUPABASE_SERVICE_ROLE_KEY);

if (!url || !anon) {
  console.error("No Supabase URL or publishable key found in .env / .env.ops");
  process.exit(1);
}

const accounts = Object.keys(ops)
  .filter((key) => key.startsWith("SV_LOGIN_"))
  .map((key) => {
    const role = key.slice("SV_LOGIN_".length);
    return {
      role,
      email: ops[key],
      password: ops[`SV_PW_${role}`] ?? ops.SV_PW_TEST,
    };
  });

console.log(`${accounts.length} sign-ins to try at ${url.replace(/https?:\/\//, "")}\n`);

let failed = 0;
for (const account of accounts) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    failed += 1;
    console.log(
      `REFUSED  ${account.role.padEnd(14)} ${account.email.padEnd(36)} ${body.error_description ?? body.msg ?? response.status}`,
    );
    continue;
  }
  const meta = body.user?.app_metadata ?? {};
  const user = body.user?.user_metadata ?? {};
  const role = meta.role ?? meta.roles ?? user.role ?? user.roles ?? "(none on the account)";
  console.log(
    `SIGNED   ${account.role.padEnd(14)} ${account.email.padEnd(36)} role: ${JSON.stringify(role)}`,
  );
}

console.log(`\n${accounts.length - failed} accepted, ${failed} refused`);
