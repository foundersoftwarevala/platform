import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns everything the Command Center dashboard needs in a single round-trip.
 *
 * Auth is validated by the shared middleware. Database read and auth failures
 * are surfaced rather than represented as an empty dashboard.
 */

function clientFor(token?: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    },
  );
}

export const getCommandCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
  const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) throw new Error("Unauthorized: sign in required.");

  const supabase = clientFor(token);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`AMS account lookup failed: ${userError.message}`);
  const userId = userData.user?.id;
  if (!userId) throw new Error("Unauthorized: the signed-in account could not be resolved.");

  const [
    userXp, profile, achievementsCount, badgesCount, trophiesCount,
    userAchievements, userBadges, userTrophies, streak,
    missionsDaily, missionsWeekly, missionsMonthly, missionsSeasonal,
    challenges, quests, campaigns, events,
    wallets, rewardsCount, claims,
    recentAch, recentBadges, recentTrophies, recentRewards,
    levelsAll, ranksAll, leaderboardDefs,
    notificationsCount, xpTxRecent,
  ] = await Promise.all([
    supabase.from("user_xp").select("*").eq("user_id", userId).order("total_xp", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("achievements").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("badges").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("trophies").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("user_achievements").select("id, achievement_id, unlocked_at, achievements(name, rarity, icon, color)").eq("user_id", userId).order("unlocked_at", { ascending: false }).limit(50),
    supabase.from("user_badges").select("id, badge_id, earned_at, badges(name, rarity, icon, color)").eq("user_id", userId).order("earned_at", { ascending: false }).limit(50),
    supabase.from("user_trophies").select("id, trophy_id, earned_at, trophies(name, tier, icon, color)").eq("user_id", userId).order("earned_at", { ascending: false }).limit(50),
    supabase.from("user_streaks").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("missions").select("id, name, description, xp_reward, ends_at").eq("cadence", "daily").eq("status", "active").limit(6),
    supabase.from("missions").select("id, name, description, xp_reward, ends_at").eq("cadence", "weekly").eq("status", "active").limit(6),
    supabase.from("missions").select("id, name, description, xp_reward, ends_at").eq("cadence", "monthly").eq("status", "active").limit(6),
    supabase.from("missions").select("id, name, description, xp_reward, ends_at").eq("cadence", "seasonal").eq("status", "active").limit(6),
    supabase.from("challenges").select("id, name, description, xp_reward, ends_at").eq("status", "active").limit(6),
    supabase.from("quests").select("id, name, description, xp_reward").eq("status", "active").limit(6),
    supabase.from("campaigns").select("id, name, description, starts_at, ends_at").eq("status", "active").limit(4),
    supabase.from("events").select("id, name, description, starts_at, ends_at").eq("status", "active").limit(4),
    supabase.from("reward_wallets").select("kind, balance").eq("user_id", userId),
    supabase.from("rewards").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("claims").select("id, status, created_at, cost_coins, cost_tokens, rewards(name, icon)").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("user_achievements").select("unlocked_at, achievements(name, rarity, icon)").eq("user_id", userId).not("unlocked_at", "is", null).order("unlocked_at", { ascending: false }).limit(8),
    supabase.from("user_badges").select("earned_at, badges(name, rarity, icon)").eq("user_id", userId).order("earned_at", { ascending: false }).limit(8),
    supabase.from("user_trophies").select("earned_at, trophies(name, tier, icon)").eq("user_id", userId).order("earned_at", { ascending: false }).limit(8),
    supabase.from("claims").select("created_at, status, rewards(name, icon)").eq("user_id", userId).in("status", ["approved", "fulfilled"]).order("created_at", { ascending: false }).limit(8),
    supabase.from("levels").select("level_number, name, xp_required").order("level_number"),
    supabase.from("ranks").select("rank_number, name, min_xp").order("rank_number"),
    supabase.from("leaderboard_definitions").select("id, name, slug, scope, metric").eq("status", "active"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("xp_transactions").select("amount, created_at, reason").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);

  const readError = [
    userXp.error,
    profile.error,
    achievementsCount.error,
    badgesCount.error,
    trophiesCount.error,
    userAchievements.error,
    userBadges.error,
    userTrophies.error,
    streak.error,
    missionsDaily.error,
    missionsWeekly.error,
    missionsMonthly.error,
    missionsSeasonal.error,
    challenges.error,
    quests.error,
    campaigns.error,
    events.error,
    wallets.error,
    rewardsCount.error,
    claims.error,
    recentAch.error,
    recentBadges.error,
    recentTrophies.error,
    recentRewards.error,
    levelsAll.error,
    ranksAll.error,
    leaderboardDefs.error,
    notificationsCount.error,
    xpTxRecent.error,
  ].find((error) => error !== null);
  if (readError) throw new Error(`AMS command-center read failed: ${readError.message}`);

  const totalXp = Number(userXp.data?.total_xp ?? 0);
  const levels = levelsAll.data ?? [];
  const ranks = ranksAll.data ?? [];
  const currentLevel = userXp.data
    ? [...levels].reverse().find((l) => totalXp >= l.xp_required) ?? levels[0] ?? null
    : null;
  const nextLevel = levels.find((l) => l.xp_required > totalXp) ?? null;
  const currentRank = userXp.data
    ? [...ranks].reverse().find((r) => totalXp >= r.min_xp) ?? ranks[0] ?? null
    : null;
  const nextRank = ranks.find((r) => r.min_xp > totalXp) ?? null;

  // Fetch top entries for the first leaderboard of each scope (global/role/territory)
  const defs = leaderboardDefs.data ?? [];
  const pickDef = (scope: string) => defs.find((d) => d.scope === scope);
  const globalDef = pickDef("global");
  const roleDef = pickDef("role");
  const territoryDef = pickDef("territory");

  const fetchEntries = async (defId: string | undefined, limit: number) => {
    if (!defId) return [];
    const r = await supabase
      .from("leaderboard_entries")
      .select("rank, score, user_id, profiles(full_name, username)")
      .eq("definition_id", defId)
      .order("rank")
      .limit(limit);
    if (r.error) throw new Error(`AMS leaderboard read failed: ${r.error.message}`);
    return r.data ?? [];
  };

  const [globalTop, roleTop, territoryTop, top100] = await Promise.all([
    fetchEntries(globalDef?.id, 10),
    fetchEntries(roleDef?.id, 10),
    fetchEntries(territoryDef?.id, 10),
    fetchEntries(globalDef?.id, 100),
  ]);

  return {
    profile: profile.data,
    totals: {
      xp: totalXp,
      achievementsCatalog: achievementsCount.count ?? 0,
      badgesCatalog: badgesCount.count ?? 0,
      trophiesCatalog: trophiesCount.count ?? 0,
      achievementsEarned: userAchievements.data?.filter((a) => a.unlocked_at).length ?? 0,
      badgesEarned: userBadges.data?.length ?? 0,
      trophiesEarned: userTrophies.data?.length ?? 0,
      rewardsCatalog: rewardsCount.count ?? 0,
      unreadNotifications: notificationsCount.count ?? 0,
    },
    progression: {
      currentLevel, nextLevel, currentRank, nextRank,
      levelProgressPct:
        currentLevel && nextLevel && nextLevel.xp_required > currentLevel.xp_required
          ? Math.min(100, Math.max(0, ((totalXp - currentLevel.xp_required) / (nextLevel.xp_required - currentLevel.xp_required)) * 100))
          : nextLevel ? 0 : 100,
      rankProgressPct:
        currentRank && nextRank && nextRank.min_xp > currentRank.min_xp
          ? Math.min(100, Math.max(0, ((totalXp - currentRank.min_xp) / (nextRank.min_xp - currentRank.min_xp)) * 100))
          : nextRank ? 0 : 100,
    },
    streak: streak.data ?? { current_streak: 0, longest_streak: 0, last_active_date: null },
    collections: {
      achievements: userAchievements.data ?? [],
      badges: userBadges.data ?? [],
      trophies: userTrophies.data ?? [],
    },
    missions: {
      daily: missionsDaily.data ?? [],
      weekly: missionsWeekly.data ?? [],
      monthly: missionsMonthly.data ?? [],
      seasonal: missionsSeasonal.data ?? [],
    },
    engagement: {
      challenges: challenges.data ?? [],
      quests: quests.data ?? [],
      campaigns: campaigns.data ?? [],
      events: events.data ?? [],
    },
    economy: {
      wallets: wallets.data ?? [],
      claims: claims.data ?? [],
    },
    timelines: {
      achievements: recentAch.data ?? [],
      badges: recentBadges.data ?? [],
      trophies: recentTrophies.data ?? [],
      rewards: recentRewards.data ?? [],
    },
    leaderboards: defs,
    leaderboardPreviews: { global: globalTop, role: roleTop, territory: territoryTop },
    halls: {
      fame: globalTop.slice(0, 3),
      champions: globalTop.slice(0, 5),
      top100,
      legends: globalTop.filter((entry) => entry.rank === 1).slice(0, 10),
    },
    xpRecent: xpTxRecent.data ?? [],
  };
});

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: { slug?: string; scope?: string }) => d)
  .handler(async ({ data }) => {
    const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const supabase = clientFor(token);
    let q = supabase.from("leaderboard_definitions").select("id").limit(1);
    if (data.slug) q = q.eq("slug", data.slug);
    else if (data.scope) q = q.eq("scope", data.scope);
    const def = await q.maybeSingle();
    if (!def.data) return { entries: [] };
    const entries = await supabase
      .from("leaderboard_entries")
      .select("rank, score, user_id, profiles(full_name, username)")
      .eq("definition_id", def.data.id)
      .order("rank")
      .limit(10);
    return { entries: entries.data ?? [] };
  });
