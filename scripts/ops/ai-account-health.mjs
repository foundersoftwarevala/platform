#!/usr/bin/env node
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { decryptAiCredential } from "../../src/lib/ai-credentials.server.ts";

function setting(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  const dir = process.env.DEPLOY_REPO_DIR || process.cwd();
  try {
    const line = readFileSync(`${dir}/.env`, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    return (
      line
        ?.slice(name.length + 1)
        .trim()
        .replace(/^(["'])([\s\S]*)\1$/, "$2") ?? ""
    );
  } catch {
    return "";
  }
}

function platformDatabaseUrl() {
  const explicit = setting("SV_PLATFORM_DATABASE_URL") || setting("I18N_DATABASE_URL");
  const value = explicit || setting("VPS_DATABASE_URL");
  if (!value) throw new Error("VPS Postgres configuration is missing.");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The AI credential health job requires PostgreSQL.");
  }
  if (explicit && decodeURIComponent(url.pathname.slice(1)) !== "sv_platform") {
    throw new Error("The AI credential health job only operates on sv_platform.");
  }
  if (!explicit) url.pathname = "/sv_platform";
  return url.toString();
}

const sql = postgres(platformDatabaseUrl(), {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  connection: { statement_timeout: 15_000, application_name: "sv-ai-api-account-health" },
  onnotice: () => {},
});

const credentialKey = setting("AI_API_CREDENTIAL_ENCRYPTION_KEY");
if (!credentialKey) {
  await sql.end({ timeout: 5 });
  throw new Error("AI_API_CREDENTIAL_ENCRYPTION_KEY is required for encrypted credential checks.");
}
const decodedKey = /^[0-9a-f]{64}$/i.test(credentialKey)
  ? Buffer.from(credentialKey, "hex")
  : Buffer.from(credentialKey, "base64");
if (decodedKey.length !== 32) {
  await sql.end({ timeout: 5 });
  throw new Error("AI_API_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes.");
}
process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY = credentialKey;

try {
  const checked = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    const expired = await tx`
      update public.api_keys
         set health_status = 'expired',
             failure_reason = 'Credential expiration time has passed.',
             cooldown_until = null
       where status = 'active'
         and expires_at <= now()
         and health_status <> 'expired'
       returning id::text
    `;
    const accounts = await tx`
      select id::text, secret_encrypted
        from public.api_keys
       where status = 'active'
         and (expires_at is null or expires_at > now())
         and (integrity_checked_at is null or integrity_checked_at < now() - interval '15 minutes')
       order by integrity_checked_at nulls first, id
       limit 250
    `;
    let count = 0;
    for (const account of accounts) {
      let integrityFailure = null;
      try {
        if (
          typeof account.secret_encrypted !== "string" ||
          !account.secret_encrypted.startsWith("enc:v1:")
        ) {
          integrityFailure = "Stored value is not in the current encrypted format.";
        } else {
          decryptAiCredential(account.secret_encrypted);
        }
      } catch {
        integrityFailure =
          "Stored encrypted credential failed integrity validation; value not logged.";
      }

      await tx`
        update public.api_keys
           set integrity_checked_at = now(),
               failure_reason = coalesce(${integrityFailure}, failure_reason)
         where id = ${account.id}::uuid and status = 'active'
      `;
      count += 1;
    }
    return { checked: count, expired: expired.length };
  });
  console.info(`[ai-api-account-health] checked=${checked.checked} expired=${checked.expired}`);
} finally {
  await sql.end({ timeout: 5 });
}
