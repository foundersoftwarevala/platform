import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CrudRecord } from "@/lib/crud-store";

/**
 * A person's AMS Center: the live rewards, missions and campaigns, their own
 * wallet, level and claims.
 *
 * The Center read a "shared pool" kept in the browser, which nothing ever
 * filled, and "claiming" marked an item in that pool and announced "Reward
 * added to your wallet". Everything here is read, as the person, from the AMS
 * tables - rewards, missions and campaigns are public to signed-in people, and
 * the wallet, XP and claims are their own under the tables' policies. A claim
 * is filed with ams_request_claim and decided by an administrator in the AMS
 * Manager; nothing is taken from the wallet until then.
 */

// The AMS tables are not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: string) => (supabase as any).from(t);

type Row = Record<string, unknown>;

async function rows(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

function record(input: Partial<CrudRecord> & { id: string; name: string; extra: CrudRecord["extra"] }): CrudRecord {
  return {
    status: "active",
    owner: "",
    category: "",
    amount: 0,
    date: new Date().toISOString(),
    notes: "",
    tags: [],
    comments: [],
    audit: [],
    attachments: [],
    ...input,
  };
}

export type AmsCenter = {
  items: CrudRecord[];
  history: CrudRecord[];
  wallet: { coins: number; tokens: number };
  xp: number;
  level: number;
  levelProgress: number;
  claimedCount: number;
};

async function load(): Promise<AmsCenter> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Please sign in to see your rewards.");
  const now = new Date().toISOString();

  const [rewards, missions, campaigns, wallets, xpRow, levels, claims, progress] = await Promise.all([
    rows(from("rewards").select("id,name,description,cost_coins,cost_tokens,stock,rarity").eq("status", "active")),
    rows(from("missions").select("id,name,description,conditions,rewards,xp_reward,ends_at").eq("status", "active")),
    rows(from("campaigns").select("id,name,description,ends_at,rewards").eq("status", "active")),
    rows(from("reward_wallets").select("kind,balance").eq("user_id", uid)),
    rows(from("user_xp").select("total_xp,current_level").eq("user_id", uid)),
    rows(from("levels").select("level_number,xp_required").order("xp_required")),
    rows(from("claims").select("id,reward_id,status,cost_coins,cost_tokens,created_at,decided_at,notes").eq("user_id", uid).order("created_at", { ascending: false })),
    rows(from("user_mission_progress").select("mission_id,progress,completed_at").eq("user_id", uid)),
  ]);

  const balance = (kind: string) => Number(wallets.find((w) => w.kind === kind)?.balance ?? 0);
  const wallet = { coins: balance("coins"), tokens: balance("tokens") };
  const open = new Map<string, Row>();
  for (const c of claims) if (c.status === "pending" || c.status === "approved") open.set(String(c.reward_id), c);
  const rewardName = new Map(rewards.map((r) => [String(r.id), String(r.name)]));
  const mine = new Map(progress.map((p) => [String(p.mission_id), p]));

  const items: CrudRecord[] = [
    ...rewards.map((r) => {
      const coins = Number(r.cost_coins ?? 0);
      const tokens = Number(r.cost_tokens ?? 0);
      const claim = open.get(String(r.id));
      const inStock = r.stock == null || Number(r.stock) > 0;
      const affordable = wallet.coins >= coins && wallet.tokens >= tokens;
      const cost = [coins ? `${coins} coins` : "", tokens ? `${tokens} tokens` : ""].filter(Boolean).join(" + ") || "free";
      return record({
        id: String(r.id),
        name: String(r.name),
        extra: {
          kind: "reward",
          description: `${String(r.description ?? "")}${r.description ? " · " : ""}Costs ${cost}.${inStock ? "" : " Out of stock."}`,
          claimed: claim ? "1" : "0",
          claimState: claim ? String(claim.status) : "",
          claimable: !claim && inStock && affordable ? "1" : "0",
        },
      });
    }),
    ...missions.map((m) => {
      const rewardsOf = (m.rewards ?? {}) as Row;
      const rules = ((m.conditions as Row | null)?.rules ?? []) as { target?: number }[];
      const target = Number(rules[0]?.target ?? 0);
      const p = mine.get(String(m.id));
      return record({
        id: String(m.id),
        name: String(m.name),
        extra: {
          kind: "mission",
          description: String(m.description ?? ""),
          xp: Number(rewardsOf.xp ?? m.xp_reward ?? 0),
          coins: Number(rewardsOf.coins ?? 0),
          gems: Number(rewardsOf.tokens ?? 0),
          progress: Number(p?.progress ?? 0),
          target,
          // Missions complete as the work is done; there is nothing to claim.
          claimable: "0",
          claimed: p?.completed_at ? "1" : "0",
          ...(m.ends_at ? { expiresAt: String(m.ends_at) } : {}),
        },
      });
    }),
    ...campaigns
      .filter((c) => !c.ends_at || String(c.ends_at) >= now)
      .map((c) =>
        record({
          id: String(c.id),
          name: String(c.name),
          extra: {
            kind: "campaign",
            description: String(c.description ?? ""),
            claimable: "0",
            ...(c.ends_at ? { expiresAt: String(c.ends_at) } : {}),
          },
        }),
      ),
  ];

  const history = claims.map((c) =>
    record({
      id: String(c.id),
      name: `${rewardName.get(String(c.reward_id)) ?? "Reward"} — ${String(c.status)}`,
      date: String(c.created_at),
      notes: String(c.notes ?? ""),
      extra: { kind: "reward", claimed: "1", claimedAt: String(c.decided_at ?? c.created_at) },
    }),
  );

  const xp = Number(xpRow[0]?.total_xp ?? 0);
  const reached = levels.filter((l) => Number(l.xp_required ?? 0) <= xp);
  const current = reached.at(-1);
  const next = levels.find((l) => Number(l.xp_required ?? 0) > xp);
  const floor = Number(current?.xp_required ?? 0);
  const levelProgress = next
    ? Math.round(((xp - floor) / Math.max(1, Number(next.xp_required) - floor)) * 100)
    : levels.length ? 100 : 0;

  return {
    items,
    history,
    wallet,
    xp,
    level: Number(xpRow[0]?.current_level ?? current?.level_number ?? 1),
    levelProgress,
    claimedCount: claims.filter((c) => c.status === "approved" || c.status === "fulfilled").length,
  };
}

export function useAmsCenter() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["ams-center"], queryFn: load });
  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => void query.refetch(),
    /** Files a claim for a reward. The administrator's approval takes the cost. */
    requestClaim: async (rewardId: string) => {
      const { error } = await supabase.rpc("ams_request_claim" as never, { p_reward: rewardId } as never);
      if (error) throw new Error(error.message);
      await client.invalidateQueries({ queryKey: ["ams-center"] });
    },
  };
}
