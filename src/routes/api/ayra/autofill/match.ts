import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import { autoFillForm } from "@/lib/ai-ceo/ayra-autofill.server";

const FieldSchema = z
  .object({
    index: z.number().int().min(0).max(99),
    name: z.string().max(200).optional(),
    id: z.string().max(200).optional(),
    label: z.string().max(200).optional(),
    placeholder: z.string().max(200).optional(),
    autocomplete: z.string().max(100).optional(),
  })
  .strict();
const RequestSchema = z.object({ fields: z.array(FieldSchema).max(100) }).strict();
const TOKEN = /^ayra_ext_[A-Za-z0-9_-]{43}$/;

async function matchFields(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!TOKEN.test(token))
    return Response.json({ error: "Extension connection expired or missing." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_000)
    return Response.json({ error: "Form field request is too large." }, { status: 413 });

  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Request body is required." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > 32_000) {
        await reader.cancel();
        return Response.json({ error: "Form field request is too large." }, { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success)
    return Response.json({ error: "Invalid form field metadata." }, { status: 400 });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [session] = await withVpsPublicDatabase(
    (tx) => tx<{ user_id: string }[]>`
    update public.ayra_extension_tokens t
       set last_used_at = now()
     where t.token_hash = ${tokenHash}
       and t.revoked_at is null
       and t.expires_at > now()
       and exists (
         select 1 from public.user_roles r
          where r.user_id = t.user_id
            and r.role::text in ('boss', 'admin', 'super_admin')
       )
    returning t.user_id::text
  `,
  );
  if (!session)
    return Response.json({ error: "Extension connection expired or revoked." }, { status: 401 });

  const fills = await autoFillForm(session.user_id, parsed.data.fields);
  return Response.json({ fills }, { headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/ayra/autofill/match")({
  server: { handlers: { POST: ({ request }) => matchFields(request) } },
});
