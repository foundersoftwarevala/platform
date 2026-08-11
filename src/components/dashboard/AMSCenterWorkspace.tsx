import { useMemo, useState } from "react";
import {
  ArrowLeft, Sparkles, Gift, Trophy, Coins, Gem, Ticket, CreditCard,
  Flame, Calendar, Clock, Star, Target, Zap, Crown, PartyPopper,
  Wallet, Bell, History, ShieldCheck, Rocket, Award, Search,
  Inbox, PackageOpen, ChevronRight, Lock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/dashboard/ui/button";
import { useCrud, type CrudRecord } from "@/lib/crud-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Shared store so ANY user dashboard reads the same AMS Manager pool.
const AMS_STORE_ROLE = "_shared";
const AMS_STORE_MODULE = "ams-center";

type AmsKind =
  | "offer" | "reward" | "bonus-daily" | "bonus-weekly" | "bonus-monthly"
  | "mission" | "coupon" | "giftcard" | "cashback" | "referral"
  | "loyalty" | "membership" | "campaign" | "flash" | "limited"
  | "event" | "unlock" | "lucky-draw" | "spin" | "scratch"
  | "treasure" | "milestone" | "login-reward" | "birthday"
  | "purchase-reward" | "premium" | "announcement";

type Tab =
  | "overview" | "offers" | "rewards" | "missions" | "bonuses"
  | "wallet" | "games" | "campaigns" | "history" | "notifications";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview",      label: "Overview",      icon: Sparkles },
  { key: "offers",        label: "Offers",        icon: Gift },
  { key: "rewards",       label: "Rewards",       icon: Trophy },
  { key: "missions",      label: "Missions",      icon: Target },
  { key: "bonuses",       label: "Bonuses",       icon: Flame },
  { key: "wallet",        label: "Wallet",        icon: Wallet },
  { key: "games",         label: "Games",         icon: PartyPopper },
  { key: "campaigns",     label: "Campaigns",     icon: Rocket },
  { key: "history",       label: "History",       icon: History },
  { key: "notifications", label: "Notifications", icon: Bell },
];

const KIND_META: Record<AmsKind, { label: string; icon: React.ComponentType<{ className?: string }>; group: Tab; tone: string }> = {
  "offer":           { label: "Active Offer",      icon: Gift,          group: "offers",        tone: "from-[oklch(0.55_0.22_265)] to-[oklch(0.55_0.25_290)]" },
  "reward":          { label: "Exclusive Reward",  icon: Trophy,        group: "rewards",       tone: "from-[oklch(0.6_0.22_45)] to-[oklch(0.55_0.24_25)]" },
  "bonus-daily":     { label: "Daily Bonus",       icon: Flame,         group: "bonuses",       tone: "from-[oklch(0.6_0.22_25)] to-[oklch(0.55_0.24_15)]" },
  "bonus-weekly":    { label: "Weekly Bonus",      icon: Calendar,      group: "bonuses",       tone: "from-[oklch(0.6_0.22_200)] to-[oklch(0.55_0.24_220)]" },
  "bonus-monthly":   { label: "Monthly Bonus",     icon: Crown,         group: "bonuses",       tone: "from-[oklch(0.6_0.22_300)] to-[oklch(0.55_0.24_320)]" },
  "mission":         { label: "Mission",           icon: Target,        group: "missions",      tone: "from-[oklch(0.6_0.2_180)] to-[oklch(0.55_0.22_200)]" },
  "coupon":          { label: "Coupon",            icon: Ticket,        group: "wallet",        tone: "from-[oklch(0.6_0.22_155)] to-[oklch(0.55_0.24_175)]" },
  "giftcard":        { label: "Gift Card",         icon: CreditCard,    group: "wallet",        tone: "from-[oklch(0.6_0.22_340)] to-[oklch(0.55_0.24_320)]" },
  "cashback":        { label: "Cashback",          icon: Coins,         group: "offers",        tone: "from-[oklch(0.7_0.2_75)] to-[oklch(0.62_0.22_55)]" },
  "referral":        { label: "Referral Reward",   icon: Sparkles,      group: "rewards",       tone: "from-[oklch(0.6_0.22_250)] to-[oklch(0.55_0.24_270)]" },
  "loyalty":         { label: "Loyalty Points",    icon: Gem,           group: "rewards",       tone: "from-[oklch(0.65_0.2_210)] to-[oklch(0.55_0.22_240)]" },
  "membership":      { label: "Membership Perk",   icon: ShieldCheck,   group: "rewards",       tone: "from-[oklch(0.6_0.2_155)] to-[oklch(0.55_0.22_140)]" },
  "campaign":        { label: "Seasonal Campaign", icon: Rocket,        group: "campaigns",     tone: "from-[oklch(0.55_0.22_290)] to-[oklch(0.5_0.24_320)]" },
  "flash":           { label: "Flash Offer",       icon: Zap,           group: "campaigns",     tone: "from-[oklch(0.7_0.22_60)] to-[oklch(0.62_0.24_35)]" },
  "limited":         { label: "Limited-Time Deal", icon: Clock,         group: "campaigns",     tone: "from-[oklch(0.6_0.22_15)] to-[oklch(0.55_0.24_355)]" },
  "event":           { label: "Event Reward",      icon: PartyPopper,   group: "campaigns",     tone: "from-[oklch(0.6_0.22_320)] to-[oklch(0.55_0.24_300)]" },
  "unlock":          { label: "Unlockable Benefit",icon: Lock,          group: "rewards",       tone: "from-[oklch(0.55_0.2_240)] to-[oklch(0.5_0.22_260)]" },
  "lucky-draw":      { label: "Lucky Draw",        icon: Sparkles,      group: "games",         tone: "from-[oklch(0.6_0.22_290)] to-[oklch(0.55_0.24_310)]" },
  "spin":            { label: "Spin & Win",        icon: Rocket,        group: "games",         tone: "from-[oklch(0.65_0.22_45)] to-[oklch(0.55_0.24_15)]" },
  "scratch":         { label: "Scratch Card",      icon: Star,          group: "games",         tone: "from-[oklch(0.65_0.2_180)] to-[oklch(0.55_0.22_200)]" },
  "treasure":        { label: "Treasure Box",      icon: Gift,          group: "games",         tone: "from-[oklch(0.6_0.22_75)] to-[oklch(0.55_0.24_55)]" },
  "milestone":       { label: "Milestone Reward",  icon: Trophy,        group: "missions",      tone: "from-[oklch(0.6_0.22_120)] to-[oklch(0.55_0.24_140)]" },
  "login-reward":    { label: "Daily Login",       icon: Flame,         group: "bonuses",       tone: "from-[oklch(0.65_0.22_35)] to-[oklch(0.55_0.24_20)]" },
  "birthday":        { label: "Birthday Reward",   icon: PartyPopper,   group: "rewards",       tone: "from-[oklch(0.65_0.2_340)] to-[oklch(0.55_0.22_320)]" },
  "purchase-reward": { label: "Purchase Reward",   icon: Award,         group: "rewards",       tone: "from-[oklch(0.6_0.2_155)] to-[oklch(0.55_0.22_175)]" },
  "premium":         { label: "Premium Reward",    icon: Crown,         group: "rewards",       tone: "from-[oklch(0.6_0.22_290)] to-[oklch(0.55_0.24_270)]" },
  "announcement":    { label: "Announcement",      icon: Bell,          group: "notifications", tone: "from-[oklch(0.55_0.15_260)] to-[oklch(0.5_0.15_240)]" },
};

function kindOf(r: CrudRecord): AmsKind {
  const k = String(r.extra.kind ?? "offer") as AmsKind;
  return (KIND_META as Record<string, unknown>)[k] ? k : "offer";
}
function isActive(r: CrudRecord) {
  const active = r.extra.active;
  if (active === 0 || active === "false") return false;
  if (r.status === "archived" || r.status === "rejected" || r.status === "draft") return false;
  const expiry = r.extra.expiresAt ? new Date(String(r.extra.expiresAt)).getTime() : NaN;
  if (!Number.isNaN(expiry) && expiry < Date.now()) return false;
  return true;
}
function progressOf(r: CrudRecord) {
  const p = Number(r.extra.progress ?? 0);
  const t = Number(r.extra.target ?? 100) || 100;
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
}
function rewardValueOf(r: CrudRecord) {
  const coins = Number(r.extra.coins ?? 0);
  const gems  = Number(r.extra.gems ?? 0);
  const xp    = Number(r.extra.xp ?? 0);
  return { coins, gems, xp };
}

export function AMSCenterWorkspace({ onBack }: { onBack: () => void }) {
  const crud = useCrud(AMS_STORE_ROLE, AMS_STORE_MODULE);
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");

  const active = useMemo(() => crud.records.filter(isActive), [crud.records]);
  const claimed = useMemo(
    () => crud.records.filter(r => String(r.extra.claimed ?? "") === "1"),
    [crud.records]
  );

  const totals = useMemo(() => {
    let coins = 0, gems = 0, xp = 0;
    for (const r of claimed) {
      const v = rewardValueOf(r);
      coins += v.coins; gems += v.gems; xp += v.xp;
    }
    const level = Math.floor(xp / 500) + 1;
    const levelProgress = xp === 0 ? 0 : Math.round(((xp % 500) / 500) * 100);
    return { coins, gems, xp, level, levelProgress };
  }, [claimed]);

  const filteredActive = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = active;
    if (tab !== "overview" && tab !== "history" && tab !== "notifications") {
      list = list.filter(r => KIND_META[kindOf(r)].group === tab);
    }
    if (tab === "notifications") list = active.filter(r => kindOf(r) === "announcement");
    if (!query) return list;
    return list.filter(r =>
      [r.name, r.notes, String(r.extra.description ?? ""), KIND_META[kindOf(r)].label]
        .some(s => s.toLowerCase().includes(query))
    );
  }, [active, tab, q]);

  function handleClaim(r: CrudRecord) {
    if (String(r.extra.claimed ?? "") === "1") {
      toast.info("Already claimed");
      return;
    }
    crud.update(r.id, { extra: { ...r.extra, claimed: "1", claimedAt: new Date().toISOString() } });
    launchConfetti();
    const v = rewardValueOf(r);
    const parts: string[] = [];
    if (v.coins) parts.push(`+${v.coins} coins`);
    if (v.gems)  parts.push(`+${v.gems} gems`);
    if (v.xp)    parts.push(`+${v.xp} XP`);
    toast.success(`Claimed: ${r.name}`, { description: parts.join(" · ") || "Reward added to your wallet" });
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight">AMS Center</h1>
          <p className="text-[11px] text-muted-foreground">
            Live offers, rewards, missions and campaigns managed by AMS Manager.
          </p>
        </div>
      </div>

      {/* Player card */}
      <div className="relative overflow-hidden rounded-3xl border border-border shadow-card">
        <div className="absolute inset-0 bg-gradient-brand opacity-90" />
        <div className="absolute -top-10 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-[oklch(0.75_0.22_320)]/30 blur-3xl" />
        <div className="relative p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 text-brand-foreground">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] opacity-80">
              <Sparkles className="h-3.5 w-3.5" /> Rewards Pass
            </div>
            <div className="mt-1 flex items-end gap-3">
              <div className="text-2xl md:text-3xl font-black">Level {totals.level}</div>
              <div className="text-xs opacity-80">{totals.xp} XP total</div>
            </div>
            <div className="mt-3 h-2 w-full max-w-md rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full bg-white/90 transition-[width] duration-500"
                style={{ width: `${totals.levelProgress}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] opacity-80">{totals.levelProgress}% to next level</div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-3 self-center">
            <StatChip icon={Coins} label="Coins" value={totals.coins} />
            <StatChip icon={Gem}   label="Gems"  value={totals.gems} />
            <StatChip icon={Trophy} label="Claimed" value={claimed.length} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-surface border border-border">
            {TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5 text-xs">
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search rewards"
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {TABS.map(t => (
          <TabsContent key={t.key} value={t.key} className="space-y-4 mt-0">
            {t.key === "overview" ? (
              <Overview
                records={active}
                claimedCount={claimed.length}
                onOpen={setTab}
                onClaim={handleClaim}
              />
            ) : t.key === "history" ? (
              <HistoryList records={crud.records} />
            ) : (
              <RewardGrid records={filteredActive} onClaim={handleClaim} sectionLabel={t.label} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

// ---------- pieces ----------

function StatChip({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/12 backdrop-blur-sm border border-white/15 px-3 py-2 min-w-[92px] text-center">
      <div className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-white/15">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function Overview({
  records, claimedCount, onOpen, onClaim,
}: {
  records: CrudRecord[];
  claimedCount: number;
  onOpen: (t: Tab) => void;
  onClaim: (r: CrudRecord) => void;
}) {
  const groups: { tab: Tab; label: string; items: CrudRecord[] }[] = [
    { tab: "offers",    label: "Active Offers",     items: records.filter(r => KIND_META[kindOf(r)].group === "offers") },
    { tab: "bonuses",   label: "Bonuses",           items: records.filter(r => KIND_META[kindOf(r)].group === "bonuses") },
    { tab: "missions",  label: "Missions & Milestones", items: records.filter(r => KIND_META[kindOf(r)].group === "missions") },
    { tab: "rewards",   label: "Exclusive Rewards", items: records.filter(r => KIND_META[kindOf(r)].group === "rewards") },
    { tab: "wallet",    label: "Wallet: Coupons & Gift Cards", items: records.filter(r => KIND_META[kindOf(r)].group === "wallet") },
    { tab: "games",     label: "Games & Draws",     items: records.filter(r => KIND_META[kindOf(r)].group === "games") },
    { tab: "campaigns", label: "Campaigns",         items: records.filter(r => KIND_META[kindOf(r)].group === "campaigns") },
  ];

  const empty = records.length === 0;

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat label="Active items"       value={records.length} icon={Sparkles} />
        <QuickStat label="Claimed rewards"    value={claimedCount}   icon={Trophy} />
        <QuickStat label="Missions available" value={records.filter(r => KIND_META[kindOf(r)].group === "missions").length} icon={Target} />
        <QuickStat label="Wallet items"       value={records.filter(r => KIND_META[kindOf(r)].group === "wallet").length} icon={Wallet} />
      </div>

      {empty && (
        <EmptyState
          title="Waiting for AMS Manager"
          sub="No active offers, rewards or campaigns yet. Anything created and activated in AMS Manager will appear here instantly for eligible users."
        />
      )}

      {groups.map(g => g.items.length > 0 && (
        <div key={g.tab}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</div>
            <button
              onClick={() => onOpen(g.tab)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
            >
              See all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {g.items.slice(0, 3).map(r => (
              <RewardCard key={r.id} record={r} onClaim={onClaim} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-[oklch(0.78_0.18_265)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function RewardGrid({ records, onClaim, sectionLabel }: { records: CrudRecord[]; onClaim: (r: CrudRecord) => void; sectionLabel: string }) {
  if (records.length === 0) {
    return (
      <EmptyState
        title={`No active ${sectionLabel.toLowerCase()} yet`}
        sub="Anything AMS Manager publishes in this category will appear here in real time."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {records.map(r => <RewardCard key={r.id} record={r} onClaim={onClaim} />)}
    </div>
  );
}

function RewardCard({ record, onClaim }: { record: CrudRecord; onClaim: (r: CrudRecord) => void }) {
  const kind = kindOf(record);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const progress = progressOf(record);
  const claimed = String(record.extra.claimed ?? "") === "1";
  const reward = rewardValueOf(record);
  const desc = String(record.extra.description ?? record.notes ?? "");
  const expires = record.extra.expiresAt ? new Date(String(record.extra.expiresAt)) : null;
  const remaining = expires ? expires.getTime() - Date.now() : 0;
  const claimable = String(record.extra.claimable ?? (progress >= 100 ? "1" : "0")) === "1";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card hover:border-brand/50 transition">
      <div className={cn("absolute inset-x-0 top-0 h-24 opacity-90 bg-gradient-to-br", meta.tone)} />
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/20 blur-2xl" />

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm border border-white/20 shadow-glow">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/85 font-semibold">{meta.label}</div>
              <div className="text-sm font-bold text-white line-clamp-1">{record.name || "Untitled"}</div>
            </div>
          </div>
          {claimed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 text-white text-[10px] px-2 py-0.5 border border-white/25">
              <ShieldCheck className="h-3 w-3" /> Claimed
            </span>
          )}
        </div>

        <div className="mt-10 space-y-3">
          {desc && (
            <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>
          )}

          {(reward.coins > 0 || reward.gems > 0 || reward.xp > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {reward.coins > 0 && <Chip icon={Coins} value={`+${reward.coins}`}  tone="amber" />}
              {reward.gems  > 0 && <Chip icon={Gem}   value={`+${reward.gems}`}   tone="violet" />}
              {reward.xp    > 0 && <Chip icon={Star}  value={`+${reward.xp} XP`} tone="brand" />}
            </div>
          )}

          {Number(record.extra.target ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={cn("h-full bg-gradient-to-r transition-[width] duration-500", meta.tone)}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {expires ? (
              <Countdown ms={remaining} />
            ) : (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Available
              </span>
            )}
            <Button
              size="sm"
              onClick={() => onClaim(record)}
              disabled={claimed || !claimable}
              className="h-8 gap-1.5 text-xs bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-95 disabled:opacity-50"
            >
              {claimed ? "Claimed" : claimable ? "Claim" : "View"}
              {!claimed && <Sparkles className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, value, tone }: { icon: React.ComponentType<{ className?: string }>; value: string; tone: "amber" | "violet" | "brand" }) {
  const toneCls =
    tone === "amber"  ? "bg-[oklch(0.78_0.16_75)]/15 text-[oklch(0.85_0.16_75)] border-[oklch(0.78_0.16_75)]/25" :
    tone === "violet" ? "bg-[oklch(0.65_0.22_320)]/15 text-[oklch(0.82_0.18_320)] border-[oklch(0.65_0.22_320)]/25" :
                        "bg-brand/15 text-[oklch(0.82_0.18_265)] border-brand/25";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums", toneCls)}>
      <Icon className="h-3 w-3" /> {value}
    </span>
  );
}

function Countdown({ ms }: { ms: number }) {
  if (ms <= 0) {
    return <span className="text-[10px] text-danger inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Expired</span>;
  }
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const label = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  return (
    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
      <Clock className="h-3 w-3" /> {label}
    </span>
  );
}

function HistoryList({ records }: { records: CrudRecord[] }) {
  const events = records
    .filter(r => String(r.extra.claimed ?? "") === "1")
    .map(r => ({
      id: r.id,
      name: r.name,
      kind: kindOf(r),
      at: String(r.extra.claimedAt ?? r.date),
      reward: rewardValueOf(r),
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (events.length === 0) {
    return (
      <EmptyState
        title="No claim history yet"
        sub="Rewards you claim will appear here with amount and timestamp."
      />
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
      {events.map(e => {
        const Icon = KIND_META[e.kind].icon;
        return (
          <div key={e.id} className="flex items-center gap-3 p-3 md:p-4">
            <div className={cn("grid h-9 w-9 place-items-center rounded-lg text-white bg-gradient-to-br", KIND_META[e.kind].tone)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{e.name}</div>
              <div className="text-[11px] text-muted-foreground">{KIND_META[e.kind].label} · {new Date(e.at).toLocaleString()}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {e.reward.coins > 0 && <Chip icon={Coins} value={`+${e.reward.coins}`} tone="amber" />}
              {e.reward.gems  > 0 && <Chip icon={Gem}   value={`+${e.reward.gems}`}  tone="violet" />}
              {e.reward.xp    > 0 && <Chip icon={Star}  value={`+${e.reward.xp} XP`} tone="brand" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="grid place-items-center text-center rounded-2xl bg-surface/40 border border-dashed border-border p-10">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        <PackageOpen className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-1 max-w-md">{sub}</div>
      <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" /> Waiting for content from AMS Manager
      </div>
    </div>
  );
}

// ---------- confetti ----------
function launchConfetti() {
  if (typeof document === "undefined") return;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);
  const colors = ["#7c5cff", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];
  const N = 80;
  for (let i = 0; i < N; i++) {
    const p = document.createElement("span");
    const size = 6 + Math.random() * 6;
    p.style.cssText = `position:absolute;top:-10px;left:${Math.random() * 100}%;width:${size}px;height:${size * 0.4}px;background:${colors[i % colors.length]};transform:rotate(${Math.random() * 360}deg);border-radius:2px;opacity:0.95;transition:transform 1.4s cubic-bezier(.2,.7,.2,1), top 1.4s cubic-bezier(.2,.7,.2,1), opacity 1.4s ease`;
    root.appendChild(p);
    requestAnimationFrame(() => {
      p.style.top = `${70 + Math.random() * 30}%`;
      p.style.transform = `translateX(${(Math.random() - 0.5) * 300}px) rotate(${Math.random() * 720}deg)`;
      p.style.opacity = "0";
    });
  }
  setTimeout(() => root.remove(), 1600);
}
