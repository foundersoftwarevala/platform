import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { callAsUser } from "@/lib/supabase-rpc.server";
import type { JsonObject } from "@/lib/json";

/**
 * The authoritative recognition projection built from the ledger and catalogue.
 */
export const RecognitionSchema = z.object({
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
  xp: z.number(),
  total_xp: z.number(),
  priority: z.number().int().nullable(),
  next: z
    .object({
      stage: z.number().int(),
      title: z.string(),
      min_xp: z.number(),
    })
    .nullable(),
  created_at: z.string(),
});

export type Recognition = z.infer<typeof RecognitionSchema>;

const responseSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
});

export const PendingRecognitionResponseSchema = responseSchema.extend({
  ok: z.literal(true),
  pending: z.array(z.string().uuid()),
});

export const PeekRecognitionsResponseSchema = responseSchema.extend({
  ok: z.literal(true),
  recognitions: z.array(RecognitionSchema),
});

export const ClaimedRecognitionsResponseSchema = responseSchema.extend({
  ok: z.literal(true),
  claimed: z.array(RecognitionSchema),
});

export function parseSuccessfulResponse<T>(result: JsonObject, schema: z.ZodType<T>): T {
  const status = responseSchema.parse(result);
  if (!status.ok) {
    throw new Error(status.reason ?? "The recognition request was refused.");
  }
  return schema.parse(result);
}

export const getAmsRecognitionPending = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ since: z.string().datetime() }).parse(input))
  .handler(async ({ data }): Promise<string[]> => {
    const result = parseSuccessfulResponse(
      await callAsUser<JsonObject>("ams_recognition_pending", {
        p_since: data.since,
      }),
      PendingRecognitionResponseSchema,
    );
    return result.pending;
  });

export const peekAmsRecognitions = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ ledgerIds: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data }): Promise<Recognition[]> => {
    const result = parseSuccessfulResponse(
      await callAsUser<JsonObject>("ams_recognition_peek", {
        p_ledger_ids: data.ledgerIds,
      }),
      PeekRecognitionsResponseSchema,
    );
    return result.recognitions;
  });

export const claimAmsRecognitions = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ ledgerIds: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data }): Promise<Recognition[]> => {
    const result = parseSuccessfulResponse(
      await callAsUser<JsonObject>("ams_recognition_claim", {
        p_ledger_ids: data.ledgerIds,
      }),
      ClaimedRecognitionsResponseSchema,
    );
    return result.claimed;
  });
