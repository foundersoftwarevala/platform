import type { TaskTransaction } from "@/lib/tasks/db.server";

export type AmsLevel = {
  level_number: number;
  xp_required: number;
};

export type AmsLevelTransition = {
  totalXp: number;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
};

export type AmsStanding = {
  role: string;
  totalXp: number;
  level: number;
  rank: number;
};

export type AmsAchievement = {
  id: string;
  title: string;
  description: string | null;
  xpReward: number;
  badgeUrl: string | null;
  type: string;
  unlocked: boolean;
  earnedAt: string | null;
};

export type AmsProfile = {
  userId: string;
  displayName: string;
  standings: AmsStanding[];
  achievements: AmsAchievement[];
  coinsBalance: number;
};

export type LeaderboardEntry = {
  position: number;
  userId: string;
  displayName: string;
  avatarPath: string | null;
  role: string;
  totalXp: number;
  level: number;
  rank: number;
};

export type AmsAwardResult = AmsLevelTransition & {
  role: string;
  xpAwarded: number;
  currentRank: number;
};

const OPERATOR_ROLES = new Set([
  "admin",
  "boss",
  "manager",
  "operator",
]);

function currentLevel(totalXp: number, levels: readonly AmsLevel[]): number {
  return levels.reduce(
    (highest, level) =>
      totalXp >= level.xp_required ? Math.max(highest, level.level_number) : highest,
    1,
  );
}

function safeNonnegativeInteger(value: string | number, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`The stored AMS ${label} is invalid.`);
  }
  return parsed;
}

export function calculateLevelTransition(
  previousXp: number,
  amount: number,
  levels: readonly AmsLevel[],
): AmsLevelTransition {
  if (!Number.isSafeInteger(previousXp) || previousXp < 0) {
    throw new Error("Previous XP must be a nonnegative safe integer.");
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Awarded XP must be a positive safe integer.");
  }

  const totalXp = previousXp + amount;
  if (!Number.isSafeInteger(totalXp)) throw new Error("The resulting XP total is too large.");

  const previousLevel = currentLevel(previousXp, levels);
  const nextLevel = currentLevel(totalXp, levels);
  return {
    totalXp,
    previousLevel,
    currentLevel: nextLevel,
    leveledUp: nextLevel > previousLevel,
  };
}

async function requireOperator(tx: TaskTransaction, actorId: string): Promise<void> {
  const roles = await tx<{ role: string }[]>`
    select role::text as role
      from public.user_roles
     where user_id = ${actorId}::uuid
  `;
  if (!roles.some(({ role }) => OPERATOR_ROLES.has(role))) {
    throw new Error("This action requires an AMS manager or administrator.");
  }
}

async function resolveRole(tx: TaskTransaction, userId: string): Promise<string> {
  const [row] = await tx<{ role: string | null }[]>`
    select public.ams_resolve_role(${userId}::uuid, null)::text as role
  `;
  if (!row?.role) throw new Error("The account has no eligible AMS role.");
  return row.role;
}

async function writeAudit(
  tx: TaskTransaction,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, string | number | boolean>,
  before: Record<string, string | number | boolean>,
  after: Record<string, string | number | boolean>,
): Promise<void> {
  await tx`
    insert into public.audit_logs
      (actor_id, actor, action, entity_type, entity_id, severity, metadata, before_state, after_state)
    values
      (${actorId}::uuid, ${actorId}, ${action}, ${entityType}, ${entityId}, 'info',
       ${JSON.stringify(metadata)}::jsonb, ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb)
  `;
}

async function applyXp(
  tx: TaskTransaction,
  actorId: string,
  userId: string,
  role: string,
  amount: number,
  reason: string,
): Promise<AmsAwardResult> {
  const [before] = await tx<{
    total_xp: string | number;
    current_level: number;
    current_rank: number;
  }[]>`
    select total_xp, current_level, current_rank
      from public.user_xp
     where user_id = ${userId}::uuid and role = ${role}
     for update
  `;
  const previousXp = safeNonnegativeInteger(before?.total_xp ?? 0, "XP total");

  const [levels, ranks] = await Promise.all([
    tx<AmsLevel[]>`
      select level_number, xp_required
        from public.levels
       where status::text = 'active'
       order by xp_required, level_number
    `,
    tx<{ rank_number: number; min_xp: number }[]>`
      select rank_number, min_xp
        from public.ranks
       where status::text = 'active'
       order by min_xp, rank_number
    `,
  ]);

  await tx`
    insert into public.xp_transactions (user_id, role, amount, reason, metadata)
    values (
      ${userId}::uuid, ${role}, ${amount},
      ${`ams:operator:${reason}`},
      ${JSON.stringify({ source: "ams.operator", actor_id: actorId })}::jsonb
    )
  `;
  await tx`
    insert into public.ams_award_ledger
      (user_id, role, asset_kind, xp_awarded, reason)
    values (${userId}::uuid, ${role}, 'xp', ${amount}, ${reason})
  `;

  const [ledgerTotal] = await tx<{ total_xp: string | number }[]>`
    select coalesce(sum(xp_awarded), 0)::bigint as total_xp
      from public.ams_award_ledger
     where user_id = ${userId}::uuid and role = ${role} and asset_kind = 'xp'
  `;
  const totalXp = safeNonnegativeInteger(ledgerTotal?.total_xp ?? 0, "ledger XP total");
  if (totalXp !== previousXp + amount) {
    throw new Error("The stored AMS XP total does not match its append-only award ledger.");
  }

  const levelTransition = calculateLevelTransition(previousXp, amount, levels);
  const level = currentLevel(totalXp, levels);
  const rank =
    ranks.reduce(
      (highest, row) => (totalXp >= row.min_xp ? Math.max(highest, row.rank_number) : highest),
      1,
    );

  await tx`
    insert into public.user_xp (user_id, role, total_xp, current_level, current_rank, updated_at)
    values (${userId}::uuid, ${role}, ${totalXp}, ${level}, ${rank}, now())
    on conflict (user_id, role) do update
      set total_xp = excluded.total_xp,
          current_level = excluded.current_level,
          current_rank = excluded.current_rank,
          updated_at = excluded.updated_at
  `;

  return {
    ...levelTransition,
    totalXp,
    currentLevel: level,
    leveledUp: level > levelTransition.previousLevel,
    currentRank: rank,
    role,
    xpAwarded: amount,
  };
}

export async function awardXpInTransaction(
  tx: TaskTransaction,
  actorId: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<AmsAwardResult> {
  await requireOperator(tx, actorId);
  const [user] = await tx<{ exists: boolean }[]>`
    select exists(select 1 from auth.users where id = ${userId}::uuid) as exists
  `;
  if (!user?.exists) throw new Error("The requested account does not exist.");

  await tx`select pg_advisory_xact_lock(hashtextextended(${"ams:" + userId}, 0))`;
  const role = await resolveRole(tx, userId);
  return applyXp(tx, actorId, userId, role, amount, reason);
}

export async function grantAchievementInTransaction(
  tx: TaskTransaction,
  actorId: string,
  userId: string,
  achievementId: string,
): Promise<{ achievement: string; newlyGranted: boolean; xp: AmsAwardResult | null }> {
  await requireOperator(tx, actorId);
  const [user] = await tx<{ exists: boolean }[]>`
    select exists(select 1 from auth.users where id = ${userId}::uuid) as exists
  `;
  if (!user?.exists) throw new Error("The requested account does not exist.");

  await tx`select pg_advisory_xact_lock(hashtextextended(${"ams:" + userId}, 0))`;
  const [achievement] = await tx<{ id: string; slug: string; name: string; xp_reward: number }[]>`
    select id::text, slug, name, xp_reward
      from public.achievements
     where id = ${achievementId}::uuid and status::text = 'active'
  `;
  if (!achievement) throw new Error("The active achievement was not found.");

  const [existing] = await tx<{ id: string; unlocked_at: Date | string | null }[]>`
    select id::text, unlocked_at
      from public.user_achievements
     where user_id = ${userId}::uuid and achievement_id = ${achievementId}::uuid
     order by unlocked_at desc nulls last
     limit 1
     for update
  `;
  if (existing?.unlocked_at) {
    return { achievement: achievement.name, newlyGranted: false, xp: null };
  }

  const role = await resolveRole(tx, userId);
  const before = await tx<{ total_xp: string | number; current_level: number; current_rank: number }[]>`
    select total_xp, current_level, current_rank
      from public.user_xp
     where user_id = ${userId}::uuid and role = ${role}
     for update
  `;
  if (existing) {
    await tx`
      update public.user_achievements
         set progress = 100, unlocked_at = now()
       where id = ${existing.id}::uuid
    `;
  } else {
    await tx`
      insert into public.user_achievements (user_id, achievement_id, progress, unlocked_at)
      values (${userId}::uuid, ${achievementId}::uuid, 100, now())
    `;
  }

  const xp =
    achievement.xp_reward > 0
      ? await applyXp(
          tx,
          actorId,
          userId,
          role,
          achievement.xp_reward,
          `achievement:${achievement.slug}`,
        )
      : null;
  await tx`
    insert into public.ams_award_ledger
      (user_id, role, asset_kind, asset_slug, xp_awarded, reason)
    values (${userId}::uuid, ${role}, 'achievement', ${achievement.slug},
            ${achievement.xp_reward}, 'manager granted achievement')
    on conflict do nothing
  `;
  const previous = before[0]
    ? {
        total_xp: Number(before[0].total_xp),
        level: before[0].current_level,
        rank: before[0].current_rank,
      }
    : { total_xp: 0, level: 1, rank: 1 };
  await writeAudit(
    tx,
    actorId,
    "ams.achievement.granted",
    "achievements",
    achievementId,
    {
      achievement_id: achievementId,
      title: achievement.name,
      target_user_id: userId,
      xp_awarded: achievement.xp_reward,
    },
    previous,
    xp
      ? { total_xp: xp.totalXp, level: xp.currentLevel, rank: xp.currentRank }
      : { total_xp: previous.total_xp, level: previous.level, rank: previous.rank },
  );
  return { achievement: achievement.name, newlyGranted: true, xp };
}

export async function getAmsProfile(
  tx: TaskTransaction,
  userId: string,
): Promise<AmsProfile> {
  const [profile] = await tx<{ full_name: string | null; username: string | null }[]>`
    select full_name, username
      from public.profiles
     where id = ${userId}::uuid
  `;
  const standings = await tx<{ role: string; total_xp: string | number; current_level: number; current_rank: number }[]>`
    select role, total_xp, current_level, current_rank
      from public.user_xp
     where user_id = ${userId}::uuid
     order by total_xp desc, role
  `;
  const achievements = await tx<{
    id: string;
    name: string;
    description: string | null;
    xp_reward: number;
    image_url: string | null;
    rarity: string;
    unlocked_at: Date | string | null;
  }[]>`
    select a.id::text, a.name, a.description, a.xp_reward, a.image_url,
           a.rarity::text as rarity, earned.unlocked_at
      from public.achievements a
      left join lateral (
        select ua.unlocked_at
          from public.user_achievements ua
         where ua.user_id = ${userId}::uuid
           and ua.achievement_id = a.id
           and ua.unlocked_at is not null
         order by ua.unlocked_at desc
         limit 1
      ) earned on true
     where a.status::text = 'active'
       and (not a.is_secret or earned.unlocked_at is not null)
     order by a.sort_order nulls last, a.name
  `;
  const [wallet] = await tx<{ balance: string | number }[]>`
    select coalesce(sum(balance), 0)::bigint as balance
      from public.reward_wallets
     where user_id = ${userId}::uuid and kind::text = 'coins'
  `;

  return {
    userId,
    displayName:
      profile?.full_name?.trim() ||
      profile?.username?.trim() ||
      `User ${userId.slice(0, 8)}`,
    standings: standings.map((row) => ({
      role: row.role,
      totalXp: safeNonnegativeInteger(row.total_xp, "XP total"),
      level: row.current_level,
      rank: row.current_rank,
    })),
    achievements: achievements.map((row) => ({
      id: row.id,
      title: row.name,
      description: row.description,
      xpReward: row.xp_reward,
      badgeUrl: row.image_url,
      type: row.rarity,
      unlocked: row.unlocked_at !== null,
      earnedAt: row.unlocked_at
        ? row.unlocked_at instanceof Date
          ? row.unlocked_at.toISOString()
          : new Date(row.unlocked_at).toISOString()
        : null,
    })),
    coinsBalance: safeNonnegativeInteger(wallet?.balance ?? 0, "coin balance"),
  };
}

export async function getAmsLeaderboard(
  tx: TaskTransaction,
): Promise<LeaderboardEntry[]> {
  const rows = await tx<{
    user_id: string;
    role: string;
    total_xp: string | number;
    current_level: number;
    current_rank: number;
    full_name: string | null;
    username: string | null;
    avatar_path: string | null;
  }[]>`
    select standing.user_id::text, standing.role, standing.total_xp,
           standing.current_level, standing.current_rank,
           profile.full_name, profile.username, profile.avatar_path
      from public.user_xp standing
      left join public.profiles profile on profile.id = standing.user_id
     order by standing.total_xp desc, standing.current_level desc,
              standing.user_id, standing.role
     limit 100
  `;
  return rows.map((row, index) => ({
    position: index + 1,
    userId: row.user_id,
    displayName:
      row.full_name?.trim() ||
      row.username?.trim() ||
      `User ${row.user_id.slice(0, 8)}`,
    avatarPath: row.avatar_path,
    role: row.role,
    totalXp: safeNonnegativeInteger(row.total_xp, "leaderboard XP total"),
    level: row.current_level,
    rank: row.current_rank,
  }));
}

export async function requireAmsOperator(
  tx: TaskTransaction,
  userId: string,
): Promise<boolean> {
  const roles = await tx<{ role: string }[]>`
    select role::text as role from public.user_roles where user_id = ${userId}::uuid
  `;
  return roles.some(({ role }) => OPERATOR_ROLES.has(role));
}
