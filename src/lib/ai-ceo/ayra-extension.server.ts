import { createHash, randomBytes } from "node:crypto";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAyraAutofillExtensionToken(userId: string): Promise<{
  token: string;
  expiresAt: string;
}> {
  if (!UUID.test(userId)) throw new Error("A valid executive user is required.");
  const token = `ayra_ext_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [row] = await withVpsPublicDatabase(async (tx) => {
    await tx`
      update public.ayra_extension_tokens
         set revoked_at = now()
       where user_id = ${userId}::uuid and revoked_at is null
    `;
    return tx<{ expires_at: string }[]>`
      insert into public.ayra_extension_tokens (token_hash, user_id, expires_at)
      values (${tokenHash}, ${userId}::uuid, now() + interval '24 hours')
      returning expires_at::text
    `;
  });
  if (!row) throw new Error("VPS Postgres did not return the extension token expiry.");
  return { token, expiresAt: row.expires_at };
}
