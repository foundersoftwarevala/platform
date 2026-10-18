import { rdOperator } from "./auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  type: z.string().min(1),
  data: z.record(z.string(), z.string()).default({}),
});

export const runRnDAIRequest = createServerFn({ method: "POST" })
  .middleware([rdOperator])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data: input }) => {
    const { runRnDAI } = await import("./rnd-ai.server");
    const result = await runRnDAI(input.type, input.data);
    return { result, type: input.type, timestamp: new Date().toISOString() };
  });
