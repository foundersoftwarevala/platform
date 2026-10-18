import { studioOperator } from "@/lib/vala-ai/studio/auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_TOTAL = 700_000;

export const analyzeProjectFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        requirement: z.string().trim().min(1).max(5000),
        files: z.array(z.object({ name: z.string().max(300), content: z.string() })).max(100),
      })
      .refine(
        (v) => v.files.reduce((n, f) => n + f.content.length, 0) <= MAX_TOTAL,
        "Files too large (max ~700 KB of text).",
      )
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { analyzeProject } = await import("./analyze.server");
    return analyzeProject(data);
  });
