import { z } from "zod";
import { structured } from "./agent.server";

const item = z.object({
  title: z.string(),
  category: z.enum(["missing", "branding", "bug"]),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  file: z.string().nullable(),
  why: z.string(),
  fix: z.string(),
});
export const planSchema = z.object({ summary: z.string(), items: z.array(item) });
export type Plan = z.infer<typeof planSchema>;

export type AnalyzeInput = { requirement: string; files: { name: string; content: string }[] };

const INSTRUCTIONS = `You are a senior software auditor in a self-healing software factory.
Given a user's requirement and project source files, find:
1) missing features/pieces needed to meet the requirement (category "missing"),
2) branding changes needed: names, logos, colours, fonts, copy (category "branding"),
3) likely bugs or risks in the code (category "bug").
Return a prioritized action plan: P0 = blocks launch, P1 = important, P2 = should do, P3 = nice to have. Sort by priority.
Reference the exact file name when relevant. Keep "why" and "fix" to one or two concrete sentences each. Reply in the same language as the requirement. Return at most 25 items.
Files named "github:<path>" come from the user's GitHub repo; other files were uploaded locally. When both exist, compare them: point out where the uploaded code differs from, is missing from, or conflicts with the GitHub version (mention both file names), and say which version should win.`;

export async function analyzeProject(input: AnalyzeInput): Promise<Plan> {
  const files = input.files.map((f) => `--- FILE: ${f.name} ---\n${f.content}`).join("\n\n");
  const { out } = await structured(
    planSchema,
    INSTRUCTIONS,
    `REQUIREMENT:\n${input.requirement}\n\nSOURCE FILES:\n${files || "(none provided)"}`,
  );
  return { ...out, items: out.items.slice(0, 25) };
}
