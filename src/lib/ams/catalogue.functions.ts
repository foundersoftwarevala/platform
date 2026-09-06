import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

/**
 * The AMS catalogue — what exists to be earned — read from the database.
 *
 * The AMS engine screens (Trophies, Levels, Ranks, Achievements, Badges) each
 * shipped with hand-written figures and rows: "1,024 Bronze", "612 Silver",
 * "Golden Architect", "Founder's Cup — 2024". None of it came from anywhere.
 * The blueprint is explicit that an executive screen must show no fabricated
 * numbers and an honest empty state when there is no data, so those screens now
 * read this.
 *
 * Reads go through the caller's own token, so the existing row-level security
 * applies unchanged: an authenticated operator may read the catalogue, only an
 * admin may write it, and anonymous access is denied outright. Holder counts
 * come from the user_* tables, so "how many people hold this" is counted rather
 * than asserted.
 */

export type CatalogueTrophy = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: string;
  role: string | null;
  stage: number | null;
  status: string;
  holders: number;
};

export type CatalogueLevel = {
  id: string;
  levelNumber: number;
  name: string;
  xpRequired: number;
  status: string;
  holders: number;
};

export type CatalogueRank = {
  id: string;
  rankNumber: number;
  name: string;
  minXp: number;
  status: string;
  holders: number;
};

export type CatalogueSimple = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rarity: string;
  status: string;
  holders: number;
};

export type AmsCatalogue = {
  authenticated: boolean;
  trophies: CatalogueTrophy[];
  levels: CatalogueLevel[];
  ranks: CatalogueRank[];
  achievements: CatalogueSimple[];
  badges: CatalogueSimple[];
  /** Names of anything that could not be read, so the UI can say so. */
  degraded: string[];
};

const EMPTY: AmsCatalogue = {
  authenticated: false,
  trophies: [],
  levels: [],
  ranks: [],
  achievements: [],
  badges: [],
  degraded: [],
};

function clientFor(token: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

/** How many people hold each id, counted from the join table. */
function tally(rows: { [k: string]: unknown }[] | null, key: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const id = String(row[key] ?? "");
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export const getAmsCatalogue = createServerFn({ method: "GET" }).handler(
  async (): Promise<AmsCatalogue> => {
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return EMPTY;

    const supabase = clientFor(token);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return EMPTY;

    const degraded: string[] = [];
    const note = (label: string, error: { message: string } | null) => {
      if (error) {
        console.error(`[ams-catalogue] ${label}: ${error.message}`);
        degraded.push(label);
      }
    };

    const [trophies, levels, ranks, achievements, badges,
           heldTrophies, heldBadges, heldAchievements, xp] = await Promise.all([
      supabase.from("trophies")
        .select("id,slug,name,description,tier,status,conditions").order("slug"),
      supabase.from("levels")
        .select("id,level_number,name,xp_required,status").order("level_number"),
      supabase.from("ranks")
        .select("id,rank_number,name,min_xp,status").order("rank_number"),
      supabase.from("achievements")
        .select("id,slug,name,description,rarity,status").order("name"),
      supabase.from("badges")
        .select("id,slug,name,description,rarity,status").order("name"),
      supabase.from("user_trophies").select("trophy_id"),
      supabase.from("user_badges").select("badge_id"),
      supabase.from("user_achievements").select("achievement_id"),
      supabase.from("user_xp").select("current_level,current_rank"),
    ]);

    note("trophies", trophies.error);
    note("levels", levels.error);
    note("ranks", ranks.error);
    note("achievements", achievements.error);
    note("badges", badges.error);

    const trophyHolders = tally(heldTrophies.data, "trophy_id");
    const badgeHolders = tally(heldBadges.data, "badge_id");
    const achievementHolders = tally(heldAchievements.data, "achievement_id");

    // Level and rank holders come from where each person currently sits.
    const levelHolders = new Map<number, number>();
    const rankHolders = new Map<number, number>();
    for (const row of xp.data ?? []) {
      const r = row as { current_level: number; current_rank: number };
      levelHolders.set(r.current_level, (levelHolders.get(r.current_level) ?? 0) + 1);
      rankHolders.set(r.current_rank, (rankHolders.get(r.current_rank) ?? 0) + 1);
    }

    return {
      authenticated: true,
      trophies: (trophies.data ?? []).map((t) => {
        const row = t as typeof t & { conditions: { role?: string; stage?: number } | null };
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          tier: String(row.tier),
          role: row.conditions?.role ?? null,
          stage: row.conditions?.stage ?? null,
          status: String(row.status),
          holders: trophyHolders.get(row.id) ?? 0,
        };
      }),
      levels: (levels.data ?? []).map((l) => ({
        id: l.id,
        levelNumber: l.level_number,
        name: l.name,
        xpRequired: l.xp_required,
        status: String(l.status),
        holders: levelHolders.get(l.level_number) ?? 0,
      })),
      ranks: (ranks.data ?? []).map((r) => ({
        id: r.id,
        rankNumber: r.rank_number,
        name: r.name,
        minXp: r.min_xp,
        status: String(r.status),
        holders: rankHolders.get(r.rank_number) ?? 0,
      })),
      achievements: (achievements.data ?? []).map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        rarity: String(a.rarity),
        status: String(a.status),
        holders: achievementHolders.get(a.id) ?? 0,
      })),
      badges: (badges.data ?? []).map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        rarity: String(b.rarity),
        status: String(b.status),
        holders: badgeHolders.get(b.id) ?? 0,
      })),
      degraded,
    };
  },
);
