import { z } from "zod";

export const AYRA_COMMAND_SETTINGS_KEY = "ai_ceo.ayra_command_center";

export const DEFAULT_AYRA_COMMAND_SETTINGS = {
  brightness: 100,
  liveReactions: false,
  motionEnabled: true,
} as const;

export const AyraCommandSettingsSchema = z
  .object({
    brightness: z.number().int().min(0).max(100),
    liveReactions: z.boolean(),
    motionEnabled: z.boolean(),
  })
  .strict();

export type AyraCommandSettings = z.infer<typeof AyraCommandSettingsSchema>;
