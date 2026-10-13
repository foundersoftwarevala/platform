import { studioOperator } from "@/lib/vala-ai/studio/auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const step = z.object({ title: z.string(), file: z.string(), goal: z.string() });
const plan = z.object({ project: z.string(), summary: z.string(), steps: z.array(step).max(8) });

export const planBuildFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z.object({ requirement: z.string().trim().min(1).max(5000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { planBuild } = await import("./agent.server");
    return planBuild(data.requirement);
  });

export const buildStepFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        requirement: z.string().max(5000),
        plan,
        index: z.number().int().min(0).max(7),
        previous: z.array(z.object({ file: z.string(), code: z.string().max(40000) })).max(8),
        runId: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { buildStep } = await import("./agent.server");
    return buildStep(data);
  });
