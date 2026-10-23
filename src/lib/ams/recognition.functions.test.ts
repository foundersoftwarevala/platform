import { describe, expect, it } from "vitest";

import {
  ClaimedRecognitionsResponseSchema,
  PeekRecognitionsResponseSchema,
  PendingRecognitionResponseSchema,
  parseSuccessfulResponse,
  RecognitionSchema,
} from "./recognition.functions";

const recognition = {
  ledger_id: "61e3a018-3e49-4308-8b43-9225a050f38a",
  role: "developer",
  type: "achievement",
  tier: "standard",
  name: "First Delivery",
  description: "Submit your first task",
  reason: "ams:first_delivery",
  rarity: "common",
  stage: null,
  previous_stage: null,
  rank: "Starter",
  level: "Level 1",
  xp: 10,
  total_xp: 10,
  priority: null,
  next: null,
  created_at: "2026-10-22T00:00:00.000Z",
};

describe("AMS recognition RPC response contract", () => {
  it("accepts the JSON payload shape returned by recognition RPCs", () => {
    expect(RecognitionSchema.parse(recognition)).toEqual(recognition);
  });

  it("rejects incomplete or unsupported recognition payloads", () => {
    expect(RecognitionSchema.safeParse({ ...recognition, ledger_id: "not-a-uuid" }).success).toBe(
      false,
    );
    expect(RecognitionSchema.safeParse({ ...recognition, tier: "unverified" }).success).toBe(false);
  });

  it("requires explicit arrays in successful RPC responses", () => {
    expect(PendingRecognitionResponseSchema.safeParse({ ok: true }).success).toBe(false);
    expect(PeekRecognitionsResponseSchema.safeParse({ ok: true }).success).toBe(false);
    expect(ClaimedRecognitionsResponseSchema.safeParse({ ok: true }).success).toBe(false);
    expect(PendingRecognitionResponseSchema.parse({ ok: true, pending: [] })).toEqual({
      ok: true,
      pending: [],
    });
    expect(PeekRecognitionsResponseSchema.parse({ ok: true, recognitions: [] })).toEqual({
      ok: true,
      recognitions: [],
    });
    expect(ClaimedRecognitionsResponseSchema.parse({ ok: true, claimed: [] })).toEqual({
      ok: true,
      claimed: [],
    });
  });

  it("surfaces RPC refusal reasons before parsing the success payload", () => {
    expect(() =>
      parseSuccessfulResponse(
        { ok: false, reason: "Recognition is not available." },
        PendingRecognitionResponseSchema,
      ),
    ).toThrow("Recognition is not available.");
    expect(() => parseSuccessfulResponse({ ok: false }, PendingRecognitionResponseSchema)).toThrow(
      "The recognition request was refused.",
    );
  });
});
