import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { aiComplete } from "@/lib/ai-gateway.server";

import { requireAmsStaff } from "./engine-views.functions";

/**
 * The AMS overview's four "Run analysis" cards.
 *
 * Each button said the feature was not built. They now read the programme's
 * real figures - XP earned and by whom, who has gone quiet, which awards are
 * being earned, what the reward shop is doing - and ask the model the AI API
 * Manager has configured to read them. The model is given only those figures
 * and told to say so when they are too thin to conclude anything; it decides
 * nothing and changes nothing. With no activity at all there is nothing to
 * analyse, and the answer says that without calling a model.
 *
 * Every call is metered by the gateway under the "ams" module, which is what
 * the AMS AI screen lists.
 */

export const ANALYSES = ["growth", "recommendation", "achievements", "rewards"] as const;
export type AnalysisKind = (typeof ANALYSES)[number];

const ASK: Record<AnalysisKind, string> = {
  growth:
    "Assess XP velocity over the period, where the programme is growing or stalling, which participants are at risk of dropping out, and any gap between what is awarded and what is earned.",
  recommendation:
    "Recommend the three most useful next actions for the AMS team this week, each tied to a figure below.",
  achievements:
    "Suggest achievements that would fit the behaviour the figures show - what people are already doing that nothing rewards, or awards nobody is reaching.",
  rewards:
    "Suggest changes to the reward shop - prices, stock, new rewards - tuned to the wallet balances and claim history below.",
};

const DAY = 86_400_000;
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

export const runAmsAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ kind: z.enum(ANALYSES) }).parse(input))
  .handler(async ({ data }) => {
    const sb = await requireAmsStaff();
    type Row = Record<string, unknown>;
    const read = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return (rows ?? []) as Row[];
    };

    const [tx30, tx60, awardsEarned, catalogue, rewards, claims, wallets, levels] = await Promise.all([
      read(sb.from("xp_transactions").select("user_id,amount,reason,created_at").gte("created_at", since(30 * DAY)).limit(200000)),
      read(sb.from("xp_transactions").select("user_id").gte("created_at", since(60 * DAY)).lt("created_at", since(30 * DAY)).limit(200000)),
      read(sb.from("user_awards").select("award_id,earned_at").gte("earned_at", since(30 * DAY)).limit(200000)),
      read(sb.from("awards").select("id,name,type,rarity,status")),
      read(sb.from("rewards").select("id,name,cost_coins,cost_tokens,stock,status")),
      read(sb.from("claims").select("reward_id,status,created_at").gte("created_at", since(90 * DAY)).limit(200000)),
      read(sb.from("reward_wallets").select("user_id,kind,balance").limit(200000)),
      read(sb.from("user_xp").select("total_xp,current_level").limit(200000)),
    ]);

    const earners = new Set(tx30.map((t) => String(t.user_id)));
    const lapsed = [...new Set(tx60.map((t) => String(t.user_id)))].filter((u) => !earners.has(u));
    if (!tx30.length && !awardsEarned.length && !claims.length) {
      return {
        kind: data.kind,
        text: null,
        reason: "There is no AMS activity to analyse yet: no XP has been earned, no award won and no reward claimed in the last 30 days.",
        model: null,
        generatedAt: new Date().toISOString(),
      };
    }

    const byReason = new Map<string, number>();
    for (const t of tx30) byReason.set(String(t.reason ?? "other"), (byReason.get(String(t.reason ?? "other")) ?? 0) + Number(t.amount ?? 0));
    const weekly = [0, 1, 2, 3].map((w) =>
      tx30.filter((t) => String(t.created_at) >= since((w + 1) * 7 * DAY) && String(t.created_at) < since(w * 7 * DAY))
        .reduce((s, t) => s + Number(t.amount ?? 0), 0),
    ).reverse();
    const awardName = new Map(catalogue.map((a) => [String(a.id), `${String(a.name)} (${String(a.type)}, ${String(a.rarity)})`]));
    const earnedCounts = new Map<string, number>();
    for (const a of awardsEarned) earnedCounts.set(String(a.award_id), (earnedCounts.get(String(a.award_id)) ?? 0) + 1);
    const claimsBy = new Map<string, number>();
    for (const c of claims) claimsBy.set(String(c.reward_id), (claimsBy.get(String(c.reward_id)) ?? 0) + 1);
    const sum = (kind: string) => wallets.filter((w) => w.kind === kind).reduce((s, w) => s + Number(w.balance ?? 0), 0);

    const facts = {
      period: "last 30 days",
      xp: {
        total: tx30.reduce((s, t) => s + Number(t.amount ?? 0), 0),
        earners: earners.size,
        weekly_totals_oldest_first: weekly,
        by_source: Object.fromEntries([...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)),
        earners_previous_30_days_who_stopped: lapsed.length,
      },
      levels: { participants: levels.length, highest: levels.reduce((m, l) => Math.max(m, Number(l.current_level ?? 0)), 0) },
      awards: {
        in_catalogue: catalogue.length,
        published: catalogue.filter((a) => a.status === "published").length,
        earned_in_period: awardsEarned.length,
        most_earned: [...earnedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ award: awardName.get(id) ?? id, times: n })),
        published_never_earned_in_period: catalogue.filter((a) => a.status === "published" && !earnedCounts.has(String(a.id))).length,
      },
      rewards: {
        live: rewards.filter((r) => r.status === "active").map((r) => ({
          name: r.name, cost_coins: r.cost_coins, cost_tokens: r.cost_tokens, stock: r.stock, claims_90_days: claimsBy.get(String(r.id)) ?? 0,
        })).slice(0, 20),
        claims_90_days: {
          pending: claims.filter((c) => c.status === "pending").length,
          approved: claims.filter((c) => c.status === "approved" || c.status === "fulfilled").length,
          rejected: claims.filter((c) => c.status === "rejected").length,
        },
        wallets: { coins_held: sum("coins"), tokens_held: sum("tokens"), holders: new Set(wallets.map((w) => String(w.user_id))).size },
      },
    };

    const result = await aiComplete({
      module: "ams",
      temperature: 0.3,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You analyse a gamification and rewards programme for its operations team. " +
            "Use only the figures you are given; do not invent numbers, people or history. " +
            "Where the figures are too thin to support a conclusion, say so plainly. " +
            "Write short sections with plain headings and bullet points.",
        },
        { role: "user", content: `${ASK[data.kind]}\n\nFigures (JSON):\n${JSON.stringify(facts)}` },
      ],
    });

    return {
      kind: data.kind,
      text: result.text,
      reason: null,
      model: result.model,
      generatedAt: new Date().toISOString(),
    };
  });
