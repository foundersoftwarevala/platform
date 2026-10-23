import { describe, expect, it } from "vitest";

import {
  parseClaimedRecognitionResult,
  parsePendingRecognitionResult,
  parseRecognitionResult,
} from "../recognition.functions";

const recognition = {
  ledger_id: "8c51a7c4-80ce-4934-980a-9c88fd9a23d4",
  role: "developer",
  type: "achievement",
  tier: "standard",
  name: "First milestone",
  description: null,
  reason: "ams:task_completed",
  rarity: "common",
  stage: null,
  previous_stage: null,
  rank: null,
  level: null,
  xp: 10,
  total_xp: 10,
  priority: null,
  next: null,
  created_at: "2026-10-22T10:00:00.000Z",
};

describe("AMS recognition RPC response contracts", () => {
  it("reads pending IDs from the canonical database response", () => {
    expect(
      parsePendingRecognitionResult({
        ok: true,
        pending: ["8c51a7c4-80ce-4934-980a-9c88fd9a23d4"],
      }),
    ).toEqual(["8c51a7c4-80ce-4934-980a-9c88fd9a23d4"]);
  });

  it("validates recognition details before presenting them", () => {
    expect(parseRecognitionResult({ ok: true, recognitions: [recognition] })).toEqual([
      recognition,
    ]);
    expect(() =>
      parseRecognitionResult({ ok: true, recognitions: [{ id: "unexpected" }] }),
    ).toThrow();
  });

  it("returns only records claimed by the database function", () => {
    expect(parseClaimedRecognitionResult({ ok: true, claimed: [recognition] })).toEqual([
      recognition,
    ]);
  });

  it("propagates an explicit database refusal", () => {
    expect(() =>
      parsePendingRecognitionResult({ ok: false, reason: "not_signed_in", pending: [] }),
    ).toThrow("not_signed_in");
  });
});
