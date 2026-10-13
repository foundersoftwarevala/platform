import { z } from "zod";
import { chat } from "../../model.server";

export async function structured<T extends z.ZodTypeAny>(
  schema: T,
  instructions: string,
  prompt: string,
  _runId?: string,
) {
  const reply = await chat(
    [
      {
        role: "system",
        content: `${instructions}\nReturn only valid JSON. ${JSON.stringify(schemaDescription(schema))}`,
      },
      { role: "user", content: prompt },
    ],
    { schema: schemaDescription(schema) },
  );
  const raw: unknown = JSON.parse(reply.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return { out: schema.parse(raw) as z.infer<T>, runId: undefined };
}

function schemaDescription(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(shape).map(([k, v]) => [k, schemaDescription(v)]),
      ),
      required: Object.keys(shape),
    };
  }
  if (schema instanceof z.ZodArray)
    return { type: "array", items: schemaDescription(schema.element) };
  if (schema instanceof z.ZodNullable)
    return { anyOf: [schemaDescription(schema.unwrap()), { type: "null" }] };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  return { type: "string" };
}

const planSchema = z.object({
  project: z.string(),
  summary: z.string(),
  steps: z
    .array(z.object({ title: z.string(), file: z.string(), goal: z.string() }))
    .min(1)
    .max(8),
});
export type BuildPlan = z.infer<typeof planSchema>;

export async function planBuild(requirement: string) {
  return structured(
    planSchema,
    "You are Vala AI's architect. Plan 3 to 6 sequential React and TypeScript build steps, each producing one file. Use a short kebab-case project name.",
    requirement,
  );
}

export async function buildStep(input: {
  requirement: string;
  plan: BuildPlan;
  index: number;
  previous: { file: string; code: string }[];
  runId?: string;
}) {
  const step = input.plan.steps[input.index];
  if (!step) throw new Error("Unknown build step.");
  return structured(
    z.object({ file: z.string(), code: z.string(), note: z.string() }),
    "Write the complete React and TypeScript contents of ONE file. Import only react or files already built. Keep it under 150 lines.",
    `REQUIREMENT:\n${input.requirement}\nSTEP:\n${JSON.stringify(step)}\nEXISTING FILES:\n${input.previous.map((f) => `--- ${f.file} ---\n${f.code}`).join("\n")}`,
  );
}
