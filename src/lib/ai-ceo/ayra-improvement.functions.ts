import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireVpsExecutive } from "./vps-auth.server";
import {
  createLowSuccessPromptProposals,
  loadAyraImprovementProposals,
  reviewAyraImprovementProposal,
} from "./ayra-improvement.server";

export const loadAyraPromptProposals = createServerFn({ method: "GET" }).handler(async () => {
  await requireVpsExecutive();
  return loadAyraImprovementProposals();
});

export const generateAyraPromptProposals = createServerFn({ method: "POST" }).handler(async () => {
  const actorId = await requireVpsExecutive();
  return createLowSuccessPromptProposals(actorId);
});

export const reviewAyraPromptProposal = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actorId = await requireVpsExecutive();
    await reviewAyraImprovementProposal(data.id, actorId, data.decision);
    return { ok: true };
  });
