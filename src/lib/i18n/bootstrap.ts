import { z } from "zod";

export const languagePackPayload = z.object({
  entries: z.record(z.string()),
  withheld: z.array(z.string()),
  locked: z.array(z.string()),
});

export type LanguageBootstrap = {
  code: string;
  entries: Record<string, string>;
  withheld: string[];
  locked: string[];
  tag: string | null;
  reason: string | null;
};
