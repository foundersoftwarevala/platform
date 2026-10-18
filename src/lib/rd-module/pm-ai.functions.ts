import { rdOperator } from "./auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  type: z.string().min(1),
  data: z.record(z.string(), z.string()).default({}),
});

export const runProManagerAIRequest = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data: input }) => {
    const { runProManagerAI } = await import("./pm-ai.server");
    const result = await runProManagerAI(input.type, input.data);
    return { result, type: input.type, timestamp: new Date().toISOString() };
  });
