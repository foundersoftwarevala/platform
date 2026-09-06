import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

/**
 * The signed-in person's own AMS standing, read from the same tables AMS
 * Manager reads.
 *
 * Every role dashboard showed AMS through `loadAmsState`, which read
 * localStorage under a key derived from the *role* — `sv.ams.author.v1`. That
 * had three consequences worth stating plainly:
 *
 *   1. Nothing persisted anywhere. XP, awards, badges and trophies lived in one
 *      browser and vanished with it, so AMS Manager could never see them.
 *   2. Two different people signing in on the same browser shared one AMS
 *      identity, because the key had no user in it. A dashboard is meant to
 *      show one person their own progression and it showed whatever the last
 *      person left behind.
 *   3. AMS Manager and the dashboards were reading different worlds, so the
 *      module could not manage what the dashboards displayed.
 *
 * This reads the real per-user rows instead, through the caller's own token so
 * row-level security applies exactly as it does everywhere else — nobody can
 * read another person's standing by asking for it.
 *
 * It is deliberately read-only. The blueprint is explicit that XP must never be
 * awarded by a frontend action, so there is no writer here: earning happens
 * from verified platform events, and AMS Manager owns the rules.
 */

export type AmsStanding = {
  /** False when nobody is signed in; the caller renders a signed-out state. */
  authenticated: boolean;
  userId: string | null;
  xp: number;
  level: number;
  rank: number;
  earnedAchievements: string[];
  earnedBadges: string[];
  earnedTrophies: string[];
  completedMissions: string[];
  claimedRewards: string[];
  currentStreak: number;
  longestStreak: number;
  joinedAt: string | null;
  /** Stable per person, derived from their account rather than their role. */
  passportId: string | null;
  /**
   * Nothing in the schema records these yet. Null rather than zero so the UI
   * can say "not tracked" instead of showing a score that was never measured.
   */
  trustScore: number | null;
  reputation: number | null;
  verified: boolean | null;
};

const SIGNED_OUT: AmsStanding = {
  authenticated: false,
  userId: null,
  xp: 0,
  level: 1,
  rank: 1,
  earnedAchievements: [],
  earnedBadges: [],
  earnedTrophies: [],
  completedMissions: [],
  claimedRewards: [],
  currentStreak: 0,
  longestStreak: 0,
  joinedAt: null,
  passportId: null,
  trustScore: null,
  reputation: null,
  verified: null,
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

/** A stable passport number for a person, derived from their account id. */
function passportNumberFor(userId: string): string {
  const hex = userId.replace(/-/g, "");
  const a = parseInt(hex.slice(0, 6), 16) % 10000;
  const b = parseInt(hex.slice(6, 12), 16) % 10000;
  return `SV-AMS-${String(a).padStart(4, "0")}-${String(b).padStart(4, "0")}`;
}

export const getAmsStanding = createServerFn({ method: "GET" }).handler(
  async (): Promise<AmsStanding> => {
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return SIGNED_OUT;

    const supabase = clientFor(token);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return SIGNED_OUT;

    // One round trip. A table that is empty is not an error — it means this
    // person has not earned anything yet, which is a real answer.
    const [xp, achievements, badges, trophies, missions, claims, streak, profile] =
      await Promise.all([
        supabase.from("user_xp").select("total_xp,current_level,current_rank")
          .eq("user_id", userId).maybeSingle(),
        // Joined to the catalogue so the UI receives slugs, which is what its
        // role definitions match on. Ids would silently match nothing.
        supabase.from("user_achievements").select("achievements(slug)")
          .eq("user_id", userId).not("unlocked_at", "is", null),
        supabase.from("user_badges").select("badges(slug)").eq("user_id", userId),
        supabase.from("user_trophies").select("trophies(slug)").eq("user_id", userId),
        supabase.from("user_mission_progress").select("mission_id,completed_at")
          .eq("user_id", userId).not("completed_at", "is", null),
        supabase.from("claims").select("reward_id,status").eq("user_id", userId),
        supabase.from("user_streaks").select("current_streak,longest_streak")
          .eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
      ]);

    const ids = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T): string[] =>
      (rows ?? []).map((r) => String(r[key])).filter(Boolean);

    /** Pulls `slug` out of an embedded row, which PostgREST may nest as an array. */
    const slugs = (rows: unknown, table: string): string[] =>
      ((rows as Record<string, unknown>[] | null) ?? [])
        .map((r) => {
          const rel = r[table] as { slug?: string } | { slug?: string }[] | null;
          const one = Array.isArray(rel) ? rel[0] : rel;
          return one?.slug ?? "";
        })
        .filter(Boolean);

    return {
      authenticated: true,
      userId,
      xp: Number(xp.data?.total_xp ?? 0),
      level: Number(xp.data?.current_level ?? 1),
      rank: Number(xp.data?.current_rank ?? 1),
      earnedAchievements: slugs(achievements.data, "achievements"),
      earnedBadges: slugs(badges.data, "badges"),
      earnedTrophies: slugs(trophies.data, "trophies"),
      completedMissions: ids(missions.data, "mission_id"),
      claimedRewards: (claims.data ?? [])
        .filter((c) => c.status !== "rejected")
        .map((c) => String(c.reward_id)),
      currentStreak: Number(streak.data?.current_streak ?? 0),
      longestStreak: Number(streak.data?.longest_streak ?? 0),
      joinedAt: profile.data?.created_at ?? null,
      passportId: passportNumberFor(userId),
      // No column records any of these yet.
      trustScore: null,
      reputation: null,
      verified: null,
    };
  },
);
