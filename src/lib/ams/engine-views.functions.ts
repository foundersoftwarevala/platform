import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ROLES as AMS_ROLES } from "./roles";

/**
 * What the AMS Manager's engine screens show, read from the AMS tables.
 *
 * Fifteen of these screens - Claims, Rewards, XP, Leaderboards, Challenges,
 * Passports, Notifications, Collections, Hall of Fame, Audit, Analytics and the
 * rest - were a template filled with typed-in rows and figures: "1,204
 * approved", "@meera.s claimed a Legendary Box for $120". Each is now read from
 * the table the AMS already keeps for it.
 *
 * A figure the platform does not record (sessions, open rates by template,
 * fraud flags) is "—", and a screen whose rows are not stored anywhere says so
 * rather than showing examples. Only the AMS team reads these; they cover
 * every participant.
 */

export const AMS_VIEWS = [
  "claims", "rewards", "xp", "leaderboards", "challenges", "passport", "notifications",
  "collections", "hall-of-fame", "audit", "analytics", "identity", "legacy", "settings", "ai",
] as const;
export type AmsView = (typeof AMS_VIEWS)[number];

export type ViewTone = "success" | "warn" | "info" | "muted" | "danger";
export type ViewKpi = { label: string; value: string; accent?: string };
export type ViewRow = { id: string; cells: Record<string, string>; status?: { label: string; tone: ViewTone } };
export type ViewResult = { kpis: ViewKpi[]; rows: ViewRow[]; empty?: string };

const STAFF = ["developer", "support", "admin", "super_admin", "boss", "boss_owner", "founder", "owner"];

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The AMS tables are not all in the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export async function requireAmsStaff() {
  // Loaded here, not at the top: this guard is exported, so the module reaches
  // the browser bundle, which must not import the server request helpers.
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Please sign in");
  const { userFromBearerToken } = await import("@/lib/auth/bearer-user.server");
  const caller = await userFromBearerToken(token);
  if (!caller) throw new Error("Please sign in");
  const sb = await db();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", caller.id);
  if (!((data ?? []) as { role: string }[]).some((r) => STAFF.includes(String(r.role)))) {
    throw new Error("The AMS Manager is for the AMS team.");
  }
  return sb;
}

const n = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("en-IN").format(v));
const DAY = 86_400_000;
const since = (ms: number) => new Date(Date.now() - ms).toISOString();
const date = (iso: unknown) => (iso ? new Date(String(iso)).toISOString().slice(0, 16).replace("T", " ") : "—");
const ago = (iso: unknown) => {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(String(iso)).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};
const toneOf = (status: string): ViewTone =>
  ["active", "approved", "fulfilled", "published", "verified", "live"].includes(status)
    ? "success"
    : ["pending", "draft", "scheduled", "review"].includes(status)
      ? "warn"
      : ["rejected", "failed", "disabled"].includes(status)
        ? "danger"
        : "muted";
const status = (s: unknown) => ({ label: String(s ?? "—").replace(/_/g, " "), tone: toneOf(String(s ?? "")) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;
type Row = Record<string, unknown>;

async function rows(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}
async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count: c, error } = await q;
  if (error) throw new Error(error.message);
  return c ?? 0;
}
const head = { count: "exact", head: true } as const;

/** Display names for a set of users, never their email addresses. */
async function names(sb: Sb, ids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const out = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 200) {
    const list = await rows(sb.from("profiles").select("id,display_name,full_name,username").in("id", unique.slice(i, i + 200)));
    for (const p of list) out.set(String(p.id), String(p.display_name || p.full_name || p.username || "").trim());
  }
  return new Map(unique.map((id) => [id, out.get(id) || `User ${id.slice(0, 8)}`]));
}

async function claims(sb: Sb): Promise<ViewResult> {
  const list = await rows(
    sb.from("claims").select("id,user_id,reward_id,status,cost_coins,cost_tokens,notes,created_at,decided_at").order("created_at", { ascending: false }).limit(2000),
  );
  const rewards = await rows(sb.from("rewards").select("id,name").in("id", [...new Set(list.map((c) => c.reward_id))].slice(0, 1000)));
  const rewardName = new Map(rewards.map((r) => [String(r.id), String(r.name)]));
  const who = await names(sb, list.map((c) => c.user_id));
  const week = since(7 * DAY);
  const decided = list.filter((c) => c.decided_at);
  const avgMs = decided.length
    ? decided.reduce((s, c) => s + (new Date(String(c.decided_at)).getTime() - new Date(String(c.created_at)).getTime()), 0) / decided.length
    : null;
  return {
    kpis: [
      { label: "Pending", value: n(list.filter((c) => c.status === "pending").length), accent: "#fbbf24" },
      { label: "Approved (7d)", value: n(list.filter((c) => c.status === "approved" && String(c.decided_at) >= week).length) },
      { label: "Rejected (7d)", value: n(list.filter((c) => c.status === "rejected" && String(c.decided_at) >= week).length) },
      { label: "Awaiting Fulfilment", value: n(list.filter((c) => c.status === "approved").length) },
      { label: "Avg Decision Time", value: avgMs == null ? "—" : `${Math.round(avgMs / 3_600_000)}h` },
      { label: "Fraud Flags", value: "—" },
    ],
    rows: list.map((c) => ({
      id: String(c.id),
      cells: {
        claim: `CLM-${String(c.id).slice(0, 8).toUpperCase()}`,
        user: who.get(String(c.user_id)) ?? "—",
        reward: rewardName.get(String(c.reward_id)) ?? "Reward",
        value: [Number(c.cost_coins) ? `${n(Number(c.cost_coins))} coins` : "", Number(c.cost_tokens) ? `${n(Number(c.cost_tokens))} tokens` : ""].filter(Boolean).join(" + ") || "Free",
        requested: ago(c.created_at),
        state: String(c.status),
      },
      status: status(c.status),
    })),
    empty: "No one has claimed a reward yet.",
  };
}

async function rewardsView(sb: Sb): Promise<ViewResult> {
  const list = await rows(sb.from("rewards").select("id,name,rarity,status,cost_coins,cost_tokens,stock,created_at").order("created_at", { ascending: false }));
  const claimed = await rows(sb.from("claims").select("reward_id,status,decided_at,cost_coins"));
  const week = since(7 * DAY);
  const issued = new Map<string, number>();
  for (const c of claimed) if (c.status === "approved" || c.status === "fulfilled") issued.set(String(c.reward_id), (issued.get(String(c.reward_id)) ?? 0) + 1);
  const granted = claimed.filter((c) => c.status === "approved" || c.status === "fulfilled");
  return {
    kpis: [
      { label: "Rewards", value: n(list.length) },
      { label: "Distributed (7d)", value: n(granted.filter((c) => String(c.decided_at) >= week).length) },
      { label: "Claim Rate", value: claimed.length ? `${Math.round((granted.length / claimed.length) * 100)}%` : "—" },
      { label: "Live", value: n(list.filter((r) => r.status === "active").length) },
      { label: "Out of Stock", value: n(list.filter((r) => r.stock != null && Number(r.stock) <= 0).length) },
      { label: "Coins Spent", value: n(granted.reduce((s, c) => s + Number(c.cost_coins ?? 0), 0)) },
    ],
    rows: list.map((r) => ({
      id: String(r.id),
      cells: {
        reward: String(r.name),
        type: r.stock == null ? "Unlimited" : `${n(Number(r.stock))} in stock`,
        rarity: String(r.rarity ?? "—"),
        issued: n(issued.get(String(r.id)) ?? 0),
        value: [Number(r.cost_coins) ? `${n(Number(r.cost_coins))} coins` : "", Number(r.cost_tokens) ? `${n(Number(r.cost_tokens))} tokens` : ""].filter(Boolean).join(" + ") || "Free",
      },
      status: status(r.status),
    })),
    empty: "No reward has been set up yet.",
  };
}

async function xp(sb: Sb): Promise<ViewResult> {
  const [rules, sources, tx] = await Promise.all([
    rows(sb.from("xp_rules").select("id,name,source_id,xp_value,multiplier,max_per_day,status").order("name")),
    rows(sb.from("xp_sources").select("id,name,status")),
    rows(sb.from("xp_transactions").select("user_id,amount").gte("created_at", since(30 * DAY)).limit(100000)),
  ]);
  const sourceName = new Map(sources.map((s) => [String(s.id), String(s.name)]));
  const total = tx.reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const people = new Set(tx.map((t) => String(t.user_id))).size;
  return {
    kpis: [
      { label: "XP Issued (30d)", value: n(total) },
      { label: "Active Rules", value: n(rules.filter((r) => r.status === "active").length) },
      { label: "Sources", value: n(sources.length) },
      { label: "Earners (30d)", value: n(people) },
      { label: "Avg / Earner", value: people ? n(Math.round(total / people)) : "—" },
      { label: "Fraud Blocked", value: "—" },
    ],
    rows: rules.map((r) => ({
      id: String(r.id),
      cells: {
        rule: String(r.name),
        source: sourceName.get(String(r.source_id)) ?? "—",
        xp: `${n(Number(r.xp_value ?? 0))}${Number(r.multiplier ?? 1) !== 1 ? ` ×${r.multiplier}` : ""}`,
        cap: r.max_per_day == null ? "No cap" : n(Number(r.max_per_day)),
      },
      status: status(r.status),
    })),
    empty: "No XP rule has been set up yet.",
  };
}

async function leaderboards(sb: Sb): Promise<ViewResult> {
  const [boards, entries, seasons] = await Promise.all([
    rows(sb.from("leaderboard_definitions").select("id,name,scope,metric,status")),
    rows(sb.from("leaderboard_entries").select("id,definition_id,user_id,rank,score,computed_at").order("rank").limit(2000)),
    rows(sb.from("seasons").select("name,ends_at,status").eq("status", "active").limit(1)),
  ]);
  const boardName = new Map(boards.map((b) => [String(b.id), String(b.name)]));
  const who = await names(sb, entries.map((e) => e.user_id));
  const season = seasons[0];
  return {
    kpis: [
      { label: "Boards", value: n(boards.length) },
      { label: "Ranked Users", value: n(new Set(entries.map((e) => String(e.user_id))).size) },
      { label: "Live Boards", value: n(boards.filter((b) => b.status === "active").length) },
      { label: "Current Season", value: season ? String(season.name) : "—" },
      { label: "Days Left", value: season?.ends_at ? n(Math.max(0, Math.ceil((new Date(String(season.ends_at)).getTime() - Date.now()) / DAY))) : "—" },
      { label: "Last Computed", value: entries.length ? ago(entries.map((e) => String(e.computed_at)).sort().at(-1)) : "—" },
    ],
    rows: entries.map((e) => ({
      id: String(e.id),
      cells: {
        rank: e.rank == null ? "—" : `#${e.rank}`,
        user: who.get(String(e.user_id)) ?? "—",
        role: boardName.get(String(e.definition_id)) ?? "—",
        score: n(Number(e.score ?? 0)),
        delta: "—",
      },
      status: { label: "ranked", tone: "info" },
    })),
    empty: boards.length ? "No board has been computed yet." : "No leaderboard has been set up yet.",
  };
}

async function challenges(sb: Sb): Promise<ViewResult> {
  const list = await rows(sb.from("challenges").select("id,name,conditions,xp_reward,rewards,starts_at,ends_at,status").order("created_at", { ascending: false }));
  const now = new Date().toISOString();
  const live = list.filter((c) => c.status === "active" && (!c.ends_at || String(c.ends_at) >= now));
  return {
    kpis: [
      { label: "Live", value: n(live.length) },
      { label: "All Challenges", value: n(list.length) },
      { label: "Ending in 7d", value: n(live.filter((c) => c.ends_at && String(c.ends_at) <= new Date(Date.now() + 7 * DAY).toISOString()).length) },
      { label: "Avg XP Reward", value: list.length ? n(Math.round(list.reduce((s, c) => s + Number(c.xp_reward ?? 0), 0) / list.length)) : "—" },
      { label: "Participants", value: "—" },
      { label: "Completed (7d)", value: "—" },
    ],
    rows: list.map((c) => ({
      id: String(c.id),
      cells: {
        challenge: String(c.name),
        mode: String((c.conditions as Row | null)?.mode ?? "—"),
        reward: `${n(Number(c.xp_reward ?? 0))} XP`,
        players: "—",
        ends: c.ends_at ? date(c.ends_at).slice(0, 10) : "No end",
      },
      status: status(c.status),
    })),
    empty: "No challenge has been set up yet.",
  };
}

async function passports(sb: Sb): Promise<ViewResult> {
  const list = await rows(sb.from("ams_passports").select("user_id,role,passport_no,issued_at,level,stage,verification").order("issued_at", { ascending: false }).limit(5000));
  const who = await names(sb, list.map((p) => p.user_id));
  return {
    kpis: [
      { label: "Issued", value: n(list.length) },
      { label: "Roles", value: n(new Set(list.map((p) => String(p.role))).size) },
      { label: "Verified", value: n(list.filter((p) => p.verification === "verified").length) },
      { label: "Issued (7d)", value: n(list.filter((p) => String(p.issued_at) >= since(7 * DAY)).length) },
      { label: "Top Level", value: list.length ? n(Math.max(...list.map((p) => Number(p.level ?? 0)))) : "—" },
      { label: "Renewals (7d)", value: "—" },
    ],
    rows: list.map((p) => ({
      id: `${p.user_id}:${p.role}`,
      cells: {
        passport: `${String(p.passport_no ?? "—")} · ${who.get(String(p.user_id))}`,
        role: String(p.role),
        level: n(Number(p.level ?? 0)),
        stamps: String(p.stage ?? "—"),
        verified: String(p.verification ?? "—"),
      },
      status: status(p.verification === "verified" ? "verified" : "pending"),
    })),
    empty: "No passport has been issued yet.",
  };
}

async function notifications(sb: Sb): Promise<ViewResult> {
  const [templates, rules, sent] = await Promise.all([
    rows(sb.from("notification_templates").select("id,key,title_template,channel,status")),
    rows(sb.from("notification_rules").select("template_id,trigger,status")),
    rows(sb.from("notifications").select("read_at").gte("created_at", since(7 * DAY)).limit(100000)),
  ]);
  const triggers = new Map<string, string>();
  for (const r of rules) if (r.template_id) triggers.set(String(r.template_id), String(r.trigger));
  const read = sent.filter((s) => s.read_at).length;
  return {
    kpis: [
      { label: "Templates", value: n(templates.length) },
      { label: "Sent (7d)", value: n(sent.length) },
      { label: "Read Rate", value: sent.length ? `${Math.round((read / sent.length) * 100)}%` : "—" },
      { label: "Rules", value: n(rules.length) },
      { label: "Failed", value: "—" },
      { label: "Channels", value: n(new Set(templates.map((t) => String(t.channel))).size) },
    ],
    rows: templates.map((t) => ({
      id: String(t.id),
      cells: {
        template: String(t.title_template || t.key),
        channel: String(t.channel ?? "—"),
        event: triggers.get(String(t.id)) ?? "—",
        sent: "—",
        open: "—",
      },
      status: status(t.status),
    })),
    empty: "No notification template has been set up yet.",
  };
}

async function collections(sb: Sb): Promise<ViewResult> {
  const [list, badges, earned] = await Promise.all([
    rows(sb.from("badge_collections").select("id,name,status,created_at")),
    rows(sb.from("badges").select("id,collection_id")),
    count(sb.from("user_badges").select("id", head)),
  ]);
  const items = new Map<string, number>();
  for (const b of badges) if (b.collection_id) items.set(String(b.collection_id), (items.get(String(b.collection_id)) ?? 0) + 1);
  return {
    kpis: [
      { label: "Collections", value: n(list.length) },
      { label: "Items", value: n([...items.values()].reduce((s, v) => s + v, 0)) },
      { label: "Badges Earned", value: n(earned) },
      { label: "Live", value: n(list.filter((c) => c.status === "active").length) },
      { label: "Completions", value: "—" },
      { label: "Retention Lift", value: "—" },
    ],
    rows: list.map((c) => ({
      id: String(c.id),
      cells: { collection: String(c.name), kind: "Badge collection", items: n(items.get(String(c.id)) ?? 0), completions: "—" },
      status: status(c.status),
    })),
    empty: "No collection has been set up yet.",
  };
}

async function hallOfFame(sb: Sb): Promise<ViewResult> {
  const top = await rows(sb.from("awards").select("id,name,rarity").in("rarity", ["legendary", "mythic", "founder"]));
  const rarity = new Map(top.map((a) => [String(a.id), String(a.rarity)]));
  const earned = top.length ? await rows(sb.from("user_awards").select("id,user_id,award_id,earned_at").in("award_id", [...rarity.keys()])) : [];
  const lifetime = await count(sb.from("user_awards").select("id", head));
  const byUser = new Map<string, Row[]>();
  for (const e of earned) byUser.set(String(e.user_id), [...(byUser.get(String(e.user_id)) ?? []), e]);
  const who = await names(sb, [...byUser.keys()]);
  return {
    kpis: [
      { label: "Inductees", value: n(byUser.size) },
      { label: "Founder Awards", value: n(earned.filter((e) => rarity.get(String(e.award_id)) === "founder").length) },
      { label: "Legendary Awards", value: n(earned.filter((e) => rarity.get(String(e.award_id)) === "legendary").length) },
      { label: "Lifetime Awards", value: n(lifetime) },
      { label: "Museum Exhibits", value: "—" },
      { label: "Views (30d)", value: "—" },
    ],
    rows: [...byUser.entries()].map(([user, list]) => ({
      id: user,
      cells: {
        inductee: who.get(user) ?? "—",
        role: "—",
        inducted: date(list.map((e) => String(e.earned_at)).sort()[0]).slice(0, 10),
        awards: n(list.length),
      },
      status: { label: [...new Set(list.map((e) => rarity.get(String(e.award_id))))].join(", "), tone: "success" },
    })),
    empty: "No one has earned a legendary, mythic or founder award yet.",
  };
}

async function audit(sb: Sb): Promise<ViewResult> {
  const [ledger, xpTx, day, xpDay, decisions, failing] = await Promise.all([
    rows(sb.from("ams_award_ledger").select("id,user_id,role,asset_kind,asset_slug,xp_awarded,reason,created_at").order("created_at", { ascending: false }).limit(500)),
    rows(sb.from("xp_transactions").select("id,user_id,role,amount,reason,created_at").order("created_at", { ascending: false }).limit(500)),
    count(sb.from("ams_award_ledger").select("id", head).gte("created_at", since(DAY))),
    count(sb.from("xp_transactions").select("id", head).gte("created_at", since(DAY))),
    count(sb.from("audit_logs").select("id", head).like("action", "ams.%").gte("occurred_at", since(DAY))),
    // Events whose evaluation failed and is waiting for the sweep to retry it.
    count(sb.from("ams_activity_events").select("id", head).is("processed_at", null).not("last_error", "is", null)),
  ]);
  const who = await names(sb, [...ledger.map((l) => l.user_id), ...xpTx.map((x) => x.user_id)]);
  // Whether each recognition reached the person: shown on their screen, kept as
  // history (granted before recognition was presented, or by a backfill), or
  // still waiting. Presentations are written at or after the ledger line.
  const oldest = ledger.reduce((m, l) => (String(l.created_at) < m ? String(l.created_at) : m), new Date().toISOString());
  const [presented, notifyFailures] = await Promise.all([
    rows(sb.from("ams_recognition_presentations").select("ledger_id,client,presented_at").gte("presented_at", oldest).limit(5000)),
    count(sb.from("error_events").select("id", head).in("fn_name", ["ams_notify_recognition", "ams_recognition_repair"]).gte("created_at", since(DAY))),
  ]);
  const shownBy = new Map(presented.map((p) => [String(p.ledger_id), String(p.client)]));
  const recognised = (l: Record<string, unknown>) =>
    String(l.reason ?? "") !== "claimed" && (String(l.asset_kind) !== "xp" || Number(l.xp_awarded ?? 0) > 0);
  const presentation = (l: Record<string, unknown>): { label: string; tone: ViewTone } => {
    if (!recognised(l)) return { label: "recorded", tone: "success" };
    const by = shownBy.get(String(l.id));
    if (by === "browser") return { label: "shown", tone: "success" };
    if (by === "historical") return { label: "history", tone: "muted" };
    if (by === "silent") return { label: "backfill", tone: "muted" };
    return { label: "not shown yet", tone: "warn" };
  };
  const waiting = ledger.filter((l) => recognised(l) && !shownBy.has(String(l.id))).length;
  const entries: (ViewRow & { at: string })[] = [
    ...ledger.map((l) => ({
      id: `award:${l.id}`,
      at: String(l.created_at),
      cells: { time: date(l.created_at), scope: String(l.asset_kind), action: String(l.reason ?? "awarded"), actor: "AMS", target: `${who.get(String(l.user_id))} · ${String(l.role ?? "—")} · ${String(l.asset_slug ?? (Number(l.xp_awarded ?? 0) ? `${n(Number(l.xp_awarded))} XP` : "—"))}` },
      status: presentation(l),
    })),
    ...xpTx.map((x) => ({
      id: `xp:${x.id}`,
      at: String(x.created_at),
      cells: { time: date(x.created_at), scope: "xp", action: String(x.reason ?? "xp"), actor: "AMS", target: `${who.get(String(x.user_id))} · ${String(x.role ?? "—")} · ${n(Number(x.amount))} XP` },
      status: { label: "recorded", tone: "success" as ViewTone },
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    kpis: [
      { label: "Award Events (24h)", value: n(day) },
      { label: "XP Events (24h)", value: n(xpDay) },
      { label: "Admin Decisions (24h)", value: n(decisions) },
      { label: "Shown", value: n(entries.length) },
      { label: "Failed, awaiting retry", value: n(failing) },
      { label: "Recognitions not yet shown", value: n(waiting) },
      { label: "Notification failures (24h)", value: n(notifyFailures) },
      { label: "Retention", value: "Kept" },
    ],
    rows: entries.map(({ at: _at, ...row }) => row),
    empty: "Nothing has been awarded or earned yet.",
  };
}

async function analytics(sb: Sb): Promise<ViewResult> {
  const [tx, events] = await Promise.all([
    rows(sb.from("xp_transactions").select("user_id,created_at").gte("created_at", since(30 * DAY)).limit(200000)),
    rows(sb.from("ams_activity_events").select("user_id,occurred_at").gte("occurred_at", since(30 * DAY)).limit(200000)),
  ]);
  const activity = [...tx.map((t) => ({ u: String(t.user_id), at: String(t.created_at) })), ...events.map((e) => ({ u: String(e.user_id), at: String(e.occurred_at) }))];
  const active = (ms: number) => new Set(activity.filter((a) => a.at >= since(ms)).map((a) => a.u)).size;
  const awarded = await count(sb.from("user_awards").select("id", head).gte("earned_at", since(30 * DAY)));
  return {
    kpis: [
      { label: "Active (24h)", value: n(active(DAY)) },
      { label: "Active (7d)", value: n(active(7 * DAY)) },
      { label: "Active (30d)", value: n(active(30 * DAY)) },
      { label: "Awards (30d)", value: n(awarded) },
      { label: "Avg Session", value: "—" },
      { label: "Retention D30", value: "—" },
    ],
    rows: [],
    empty: "No analytics report is stored. The figures above are counted live from XP and activity.",
  };
}

async function identity(): Promise<ViewResult> {
  // The role identities are product configuration (src/lib/ams/roles.ts), not
  // rows: each role's motto, signature and celebration as the AMS uses them.
  return {
    kpis: [
      { label: "Personas", value: n(AMS_ROLES.length) },
      { label: "Mottos", value: n(AMS_ROLES.filter((r) => r.motto).length) },
      { label: "Celebrations", value: n(AMS_ROLES.filter((r) => r.celebration).length) },
      { label: "Vocabulary", value: n(new Set(AMS_ROLES.flatMap((r) => r.language ?? [])).size) },
      { label: "Coverage", value: `${Math.round((AMS_ROLES.filter((r) => r.motto && r.signature && r.celebration).length / AMS_ROLES.length) * 100)}%` },
      { label: "Reviews", value: "—" },
    ],
    rows: AMS_ROLES.map((r) => ({
      id: r.slug,
      cells: { role: r.name, motto: r.motto, signature: r.signature, celebration: r.celebration },
      status: { label: "configured", tone: "success" },
    })),
  };
}

async function legacy(sb: Sb): Promise<ViewResult> {
  const milestones = await count(sb.from("awards").select("id", head).eq("type", "milestone"));
  return {
    kpis: [
      { label: "Milestone Awards", value: n(milestones) },
      { label: "Timelines", value: "—" },
      { label: "Museum Exhibits", value: "—" },
      { label: "Featured", value: "—" },
      { label: "Visitors (30d)", value: "—" },
      { label: "Curators", value: "—" },
    ],
    rows: [],
    empty: "No legacy entry is stored on the platform yet.",
  };
}

async function settings(sb: Sb): Promise<ViewResult> {
  const list = await rows(sb.from("system_settings").select("id,key,label,value,category,updated_at").ilike("category", "ams%"));
  return {
    kpis: [
      { label: "Settings", value: n(list.length) },
      { label: "Groups", value: n(new Set(list.map((s) => String(s.category))).size) },
      { label: "Changed (30d)", value: n(list.filter((s) => String(s.updated_at) >= since(30 * DAY)).length) },
      { label: "Feature Flags", value: "—" },
      { label: "Integrations", value: "—" },
      { label: "Env", value: "Production" },
    ],
    rows: list.map((s) => ({
      id: String(s.id),
      cells: { key: String(s.label || s.key), group: String(s.category), value: typeof s.value === "string" ? s.value : JSON.stringify(s.value), updated: date(s.updated_at) },
      status: { label: "set", tone: "success" },
    })),
    empty: "No AMS setting is stored yet; the AMS runs on its defaults.",
  };
}

async function ai(sb: Sb): Promise<ViewResult> {
  const runs = await rows(
    sb.from("usage_events").select("id,occurred_at,model_id,tokens_in,tokens_out,success,source").eq("product", "ams").order("occurred_at", { ascending: false }).limit(500),
  );
  const day = runs.filter((r) => String(r.occurred_at) >= since(DAY));
  return {
    kpis: [
      { label: "Analyses (7d)", value: n(runs.filter((r) => String(r.occurred_at) >= since(7 * DAY)).length) },
      { label: "Succeeded", value: runs.length ? `${Math.round((runs.filter((r) => r.success).length / runs.length) * 100)}%` : "—" },
      { label: "Tokens (24h)", value: n(day.reduce((s, r) => s + Number(r.tokens_in ?? 0) + Number(r.tokens_out ?? 0), 0)) },
      { label: "Runs Shown", value: n(runs.length) },
      { label: "Anomalies Flagged", value: "—" },
      { label: "Auto-Approvals", value: "—" },
    ],
    rows: runs.map((r) => ({
      id: String(r.id),
      cells: { assistant: "AMS analysis", model: String(r.model_id ?? "—"), runs: date(r.occurred_at) },
      status: r.success ? { label: "succeeded", tone: "success" } : { label: "failed", tone: "danger" },
    })),
    empty: "No AMS analysis has been run yet. Run one from the AMS overview.",
  };
}

export const getAmsView = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ view: z.enum(AMS_VIEWS) }).parse(input))
  .handler(async ({ data }): Promise<ViewResult> => {
    const sb = await requireAmsStaff();
    switch (data.view) {
      case "claims": return claims(sb);
      case "rewards": return rewardsView(sb);
      case "xp": return xp(sb);
      case "leaderboards": return leaderboards(sb);
      case "challenges": return challenges(sb);
      case "passport": return passports(sb);
      case "notifications": return notifications(sb);
      case "collections": return collections(sb);
      case "hall-of-fame": return hallOfFame(sb);
      case "audit": return audit(sb);
      case "analytics": return analytics(sb);
      case "identity": return identity();
      case "legacy": return legacy(sb);
      case "settings": return settings(sb);
      case "ai": return ai(sb);
    }
  });

/** An administrator's decision on a claim, made as them by the database's own rule. */
export const decideClaim = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "fulfilled"]),
      note: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new Error("Please sign in");
    const { rpcAs } = await import("@/lib/applications/gateway.server");
    const outcome = await rpcAs(token, "ams_decide_claim", { p_claim: data.id, p_decision: data.decision, p_note: data.note ?? null });
    if (!outcome.ok) throw new Error(outcome.message);
    return { ok: true };
  });
