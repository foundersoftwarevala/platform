import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ledgerIdsInput = z.object({
  ledgerIds: z.array(z.string().uuid()).min(1).max(50),
});

const pendingInput = z.object({
  since: z.string().datetime(),
});

const recognitionSchema = z.object({
  ledger_id: z.string().uuid(),
  role: z.string(),
  type: z.string(),
  tier: z.enum(["standard", "legendary", "legacy"]),
  name: z.string(),
  description: z.string().nullable(),
  reason: z.string().nullable(),
  rarity: z.string().nullable(),
  stage: z.number().int().nullable(),
  previous_stage: z.number().int().nullable(),
  rank: z.string().nullable(),
  level: z.string().nullable(),
  xp: z.number().int(),
  total_xp: z.number().int(),
  priority: z.number().int().nullable(),
  next: z
    .object({
      stage: z.number().int(),
      title: z.string(),
      min_xp: z.number().int(),
    })
    .nullable(),
  created_at: z.string(),
});

export type AmsRecognition = z.infer<typeof recognitionSchema>;

const pendingResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  pending: z.array(z.string().uuid()),
});
const recognitionsResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  recognitions: z.array(recognitionSchema),
});
const claimedResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  claimed: z.array(recognitionSchema),
});

function requireOk<T extends { ok: boolean; reason?: string }>(result: T): T {
  if (!result.ok) {
    throw new Error(`AMS recognition request failed: ${result.reason ?? "unknown reason"}`);
  }
  return result;
}

export function parsePendingRecognitionResult(value: unknown): string[] {
  return requireOk(pendingResultSchema.parse(value)).pending;
}

export function parseRecognitionResult(value: unknown): AmsRecognition[] {
  return requireOk(recognitionsResultSchema.parse(value)).recognitions;
}

export function parseClaimedRecognitionResult(value: unknown): AmsRecognition[] {
  return requireOk(claimedResultSchema.parse(value)).claimed;
}

async function transactionForUser<T>(
  userId: string,
  run: (tx: import("@/lib/tasks/db.server").TaskTransaction) => Promise<T>,
): Promise<T> {
  const { withTaskTransaction } = await import("@/lib/tasks/db.server");
  return withTaskTransaction(userId, run);
}

export const getPendingAmsRecognitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => pendingInput.parse(input))
  .handler(async ({ data, context }) =>
    transactionForUser(context.userId, async (tx) => {
      const [row] = await tx<{ result: unknown }[]>`
        select public.ams_recognition_pending(${data.since}::timestamptz) as result
      `;
      return parsePendingRecognitionResult(row?.result);
    }),
  );

export const getAmsRecognitionsByLedgerIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ledgerIdsInput.parse(input))
  .handler(async ({ data, context }) =>
    transactionForUser(context.userId, async (tx) => {
      const [row] = await tx<{ result: unknown }[]>`
        select public.ams_recognition_peek(${data.ledgerIds}::uuid[]) as result
      `;
      return parseRecognitionResult(row?.result);
    }),
  );

export const claimAmsRecognitions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ledgerIdsInput.parse(input))
  .handler(async ({ data, context }) =>
    transactionForUser(context.userId, async (tx) => {
      const [row] = await tx<{ result: unknown }[]>`
        select public.ams_recognition_claim(${data.ledgerIds}::uuid[]) as result
      `;
      return parseClaimedRecognitionResult(row?.result);
    }),
  );
