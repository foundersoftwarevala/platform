import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rest } from "@/lib/marketplace/author-guard";

type DeveloperProfileRow = { skill_tags?: unknown };

// AUDIT-FIX: Return only the signed-in developer's persisted skill tags.
export const getDeveloperProfileSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ linked: boolean; skills: string[] }> => {
    const response = await rest(
      `developers?select=skill_tags&user_id=eq.${encodeURIComponent(context.userId)}&limit=1`,
    );
    if (!response.ok) {
      throw new Error(`Developer profile could not be read (${response.status})`);
    }

    const profiles = (await response.json()) as DeveloperProfileRow[];
    const profile = profiles[0];
    const skills = Array.isArray(profile?.skill_tags)
      ? profile.skill_tags.filter(
          (skill): skill is string => typeof skill === "string" && skill.trim().length > 0,
        )
      : [];

    return { linked: Boolean(profile), skills };
  });
