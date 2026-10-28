import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { encryptAiCredential } from "@/lib/ai-credentials.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import { requireVpsExecutive } from "./vps-auth.server";

export const AYRA_EXTERNAL_SERVICES = [
  "google_cloud",
  "cloudflare",
  "github",
  "facebook",
  "instagram",
  "youtube",
] as const;
export type AyraExternalService = (typeof AYRA_EXTERNAL_SERVICES)[number];

export type AyraCredentialStatus = {
  serviceName: AyraExternalService;
  configured: boolean;
  lastUpdated: string | null;
};

const CredentialRowSchema = z.object({
  service_name: z.enum(AYRA_EXTERNAL_SERVICES),
  status: z.enum(["not_configured", "stored", "revoked"]),
  last_updated: z.string().nullable(),
});

export const loadAyraCredentialStatuses = createServerFn({ method: "GET" }).handler(
  async (): Promise<AyraCredentialStatus[]> => {
    await requireVpsExecutive();
    const rows = await withVpsPublicDatabase(
      (tx) => tx<z.infer<typeof CredentialRowSchema>[]>`
      select service_name, status, last_updated::text
        from public.ayra_external_credentials
       order by service_name
    `,
    );
    const byService = new Map(
      rows.map((row) => {
        const parsed = CredentialRowSchema.parse(row);
        return [parsed.service_name, parsed] as const;
      }),
    );
    return AYRA_EXTERNAL_SERVICES.map((serviceName) => {
      const row = byService.get(serviceName);
      return {
        serviceName,
        configured: row?.status === "stored",
        lastUpdated: row?.last_updated ?? null,
      };
    });
  },
);

export const saveAyraCredential = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        serviceName: z.enum(AYRA_EXTERNAL_SERVICES),
        token: z.string().trim().min(1).max(16_384),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const actorId = await requireVpsExecutive();
    const encryptedToken = encryptAiCredential(data.token);
    await withVpsPublicDatabase(async (tx) => {
      await tx`
        insert into public.ayra_external_credentials
          (service_name, encrypted_token, status, last_updated, updated_by)
        values (${data.serviceName}, ${encryptedToken}, 'stored', now(), ${actorId}::uuid)
        on conflict (service_name) do update
          set encrypted_token = excluded.encrypted_token,
              status = 'stored',
              last_updated = now(),
              updated_by = excluded.updated_by
      `;
      await tx`
        insert into public.ayra_external_credential_audit
          (service_name, actor_id, action)
        values (${data.serviceName}, ${actorId}::uuid, 'credential_stored')
      `;
    });
    return { ok: true };
  });

export const revokeAyraCredential = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ serviceName: z.enum(AYRA_EXTERNAL_SERVICES) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const actorId = await requireVpsExecutive();
    await withVpsPublicDatabase(async (tx) => {
      await tx`
        insert into public.ayra_external_credentials
          (service_name, encrypted_token, status, last_updated, updated_by)
        values (${data.serviceName}, null, 'revoked', now(), ${actorId}::uuid)
        on conflict (service_name) do update
          set encrypted_token = null,
              status = 'revoked',
              last_updated = now(),
              updated_by = excluded.updated_by
      `;
      await tx`
        insert into public.ayra_external_credential_audit
          (service_name, actor_id, action)
        values (${data.serviceName}, ${actorId}::uuid, 'credential_revoked')
      `;
    });
    return { ok: true };
  });
