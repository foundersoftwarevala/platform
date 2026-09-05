import { formatDistanceToNowStrict } from "date-fns";
import {
  Trophy, Shield, Award, Zap, ArrowUpCircle, Crown, Flame, History, Target,
  Compass, Swords, Calendar, CalendarDays, Gift, Wallet, Coins, CircleDollarSign,
  PackageCheck, Sparkles, BarChart3, Star, Activity, TrendingUp, Bell, Medal,
} from "lucide-react";
import { SectionTitle, StatCard, ProgressBar, EmptyHint } from "./Primitives";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ams/effects/AnimatedNumber";

type Data = any; // shape matches getCommandCenter return

const fmt = new Intl.NumberFormat();

export function Row1Totals({ data }: { data: Data }) {
  const t = data.totals;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Total XP" value={<AnimatedNumber value={t.xp} />} sub="lifetime" icon={<Zap className="h-5 w-5" />} accent="xp" />
      <StatCard label="Current Level" value={data.progression.currentLevel?.level_number ?? "—"} sub={data.progression.currentLevel?.name ?? "no levels yet"} icon={<ArrowUpCircle className="h-5 w-5" />} accent="primary" />
      <StatCard label="Current Rank" value={data.progression.currentRank?.name ?? "—"} sub={data.progression.currentRank ? `#${data.progression.currentRank.rank_number}` : "no ranks yet"} icon={<Crown className="h-5 w-5" />} accent="legendary" />
      <StatCard label="Achievements" value={`${t.achievementsEarned}/${t.achievementsCatalog}`} sub="unlocked / total" icon={<Trophy className="h-5 w-5" />} accent="trophy" />
      <StatCard label="Badges" value={`${t.badgesEarned}/${t.badgesCatalog}`} sub="earned / total" icon={<Shield className="h-5 w-5" />} accent="secondary" />
      <StatCard label="Trophies" value={`${t.trophiesEarned}/${t.trophiesCatalog}`} sub="earned / total" icon={<Award className="h-5 w-5" />} accent="trophy" />
    </div>
  );
}

export function Row2Progress({ data }: { data: Data }) {
  const p = data.progression;
  const s = data.streak;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
      <Card title="XP Progress" icon={<Zap className="h-4 w-4 text-xp" />}>
        <div className="text-3xl font-bold tabular-nums text-gradient-primary"><AnimatedNumber value={data.totals.xp} duration={800} /></div>
        <div className="text-xs text-muted-foreground mt-1">total xp earned</div>
        <div className="mt-3"><ProgressBar pct={p.levelProgressPct} /></div>
      </Card>
      <Card title="Next Level" icon={<ArrowUpCircle className="h-4 w-4 text-primary" />}>
        <div className="text-3xl font-bold tabular-nums">{p.nextLevel ? `L${p.nextLevel.level_number}` : "MAX"}</div>
        <div className="text-xs text-muted-foreground mt-1">{p.nextLevel ? `${fmt.format(p.nextLevel.xp_required - data.totals.xp)} XP to ${p.nextLevel.name}` : "Top of progression"}</div>
        <div className="mt-3"><ProgressBar pct={p.levelProgressPct} /></div>
      </Card>
      <Card title="Rank Progress" icon={<Crown className="h-4 w-4 text-legendary" />}>
        <div className="text-3xl font-bold tabular-nums">{p.nextRank ? p.nextRank.name : "APEX"}</div>
        <div className="text-xs text-muted-foreground mt-1">{p.nextRank ? `${fmt.format(p.nextRank.min_xp - data.totals.xp)} XP to next rank` : "Highest rank achieved"}</div>
        <div className="mt-3"><ProgressBar pct={p.rankProgressPct} gradient="var(--gradient-trophy)" /></div>
      </Card>
      <Card title="Current Streak" icon={<Flame className="h-4 w-4 text-legendary" />}>
        <div className="text-3xl font-bold tabular-nums rarity-legendary">{s.current_streak ?? 0}<span className="text-base text-muted-foreground ml-1">days</span></div>
        <div className="text-xs text-muted-foreground mt-1">{s.last_active_date ? `last active ${s.last_active_date}` : "no activity yet"}</div>
      </Card>
      <Card title="Longest Streak" icon={<History className="h-4 w-4 text-trophy" />}>
        <div className="text-3xl font-bold tabular-nums text-gradient-trophy">{s.longest_streak ?? 0}<span className="text-base text-muted-foreground ml-1">days</span></div>
        <div className="text-xs text-muted-foreground mt-1">all-time best</div>
      </Card>
    </div>
  );
}

export function Row3Collections({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <Card title="Achievement Progress Map" icon={<Trophy className="h-4 w-4 text-trophy" />} fill>
        {data.totals.achievementsCatalog === 0 ? (
          <EmptyHint>No achievements configured yet. Create some in the Achievements page.</EmptyHint>
        ) : (
          <div className="grid grid-cols-8 gap-1.5 mt-2">
            {Array.from({ length: data.totals.achievementsCatalog }).map((_, i) => {
              const unlocked = i < data.totals.achievementsEarned;
              return (
                <div key={i} className={cn(
                  "aspect-square rounded-md border",
                  unlocked ? "bg-trophy/30 border-trophy/60 glow-trophy" : "bg-muted/30 border-border"
                )} />
              );
            })}
          </div>
        )}
      </Card>
      <Card title="Badge Collection" icon={<Shield className="h-4 w-4 text-secondary" />} fill>
        {data.collections.badges.length === 0 ? <EmptyHint>No badges earned yet.</EmptyHint> : (
          <div className="grid grid-cols-6 gap-2 mt-2">
            {data.collections.badges.slice(0, 18).map((b: any) => (
              <RarityChip key={b.id} name={b.badges?.name} rarity={b.badges?.rarity} />
            ))}
          </div>
        )}
      </Card>
      <Card title="Trophy Collection" icon={<Award className="h-4 w-4 text-trophy" />} fill>
        {data.collections.trophies.length === 0 ? <EmptyHint>No trophies earned yet.</EmptyHint> : (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {data.collections.trophies.slice(0, 12).map((t: any) => (
              <div key={t.id} className="p-2 rounded-lg surface-card text-center">
                <Award className={cn("h-6 w-6 mx-auto", tierColor(t.trophies?.tier))} />
                <div className="text-[10px] mt-1 truncate">{t.trophies?.name}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function Row4Leaderboards({ data }: { data: Data }) {
  const p = data.leaderboardPreviews ?? { global: [], role: [], territory: [] };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <LeaderboardCard title="Global Leaderboard" icon={<BarChart3 className="h-4 w-4 text-primary" />} entries={p.global} hint="No global leaderboard configured yet." />
      <LeaderboardCard title="Role Leaderboard" icon={<Medal className="h-4 w-4 text-secondary" />} entries={p.role} hint="Define a role-scoped leaderboard to populate this." />
      <LeaderboardCard title="Territory Leaderboard" icon={<TrendingUp className="h-4 w-4 text-xp" />} entries={p.territory} hint="Define a territory-scoped leaderboard to populate this." />
    </div>
  );
}

export function Row5Missions({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <MissionsCard title="Daily Missions" cadenceLabel="Resets daily" icon={<Target className="h-4 w-4 text-primary" />} items={data.missions.daily} />
      <MissionsCard title="Weekly Missions" cadenceLabel="Resets weekly" icon={<Target className="h-4 w-4 text-secondary" />} items={data.missions.weekly} />
      <MissionsCard title="Monthly Missions" cadenceLabel="Resets monthly" icon={<Target className="h-4 w-4 text-trophy" />} items={data.missions.monthly} />
      <MissionsCard title="Seasonal Missions" cadenceLabel="Resets per season" icon={<Target className="h-4 w-4 text-legendary" />} items={data.missions.seasonal} />
    </div>
  );
}

export function Row6Engagement({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <ListCard title="Active Challenges" icon={<Swords className="h-4 w-4 text-mythic" />} items={data.engagement.challenges} />
      <ListCard title="Active Quests" icon={<Compass className="h-4 w-4 text-primary" />} items={data.engagement.quests} />
      <ListCard title="Campaign Progress" icon={<Calendar className="h-4 w-4 text-secondary" />} items={data.engagement.campaigns} />
      <ListCard title="Event Progress" icon={<CalendarDays className="h-4 w-4 text-trophy" />} items={data.engagement.events} />
    </div>
  );
}

export function Row7Wallets({ data }: { data: Data }) {
  const wallets = data.economy.wallets as { kind: string; balance: number }[];
  const w = (k: string) => wallets.find((x) => x.kind === k)?.balance ?? 0;
  const pendingClaims = (data.economy.claims as any[]).filter((c) => c.status === "pending").length;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Rewards Wallet" value={fmt.format(w("rewards"))} sub="redeemable" icon={<Wallet className="h-5 w-5" />} accent="primary" />
      <StatCard label="Coins Wallet" value={fmt.format(w("coins"))} sub="earned coins" icon={<Coins className="h-5 w-5" />} accent="trophy" />
      <StatCard label="Tokens Wallet" value={fmt.format(w("tokens"))} sub="event tokens" icon={<CircleDollarSign className="h-5 w-5" />} accent="secondary" />
      <StatCard label="Pending Claims" value={fmt.format(pendingClaims)} sub="awaiting approval" icon={<PackageCheck className="h-5 w-5" />} accent="xp" />
    </div>
  );
}

export function Row8Rewards({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <Card title="Available Rewards" icon={<Gift className="h-4 w-4 text-primary" />}>
        <div className="text-3xl font-bold tabular-nums">{data.totals.rewardsCatalog}</div>
        <div className="text-xs text-muted-foreground mt-1">items in store</div>
      </Card>
      <Card title="Redeem Rewards" icon={<Sparkles className="h-4 w-4 text-secondary" />}>
        <EmptyHint>Browse the Reward Store to redeem.</EmptyHint>
      </Card>
      <Card title="Claim Status" icon={<PackageCheck className="h-4 w-4 text-xp" />}>
        {data.economy.claims.length === 0 ? <EmptyHint>No claims yet.</EmptyHint> : (
          <ul className="text-xs space-y-1.5">
            {data.economy.claims.slice(0, 4).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="truncate">{c.rewards?.name ?? "Reward"}</span>
                <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded", statusBadge(c.status))}>{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Reward History" icon={<History className="h-4 w-4 text-muted-foreground" />}>
        {data.timelines.rewards.length === 0 ? <EmptyHint>No reward history yet.</EmptyHint> : (
          <ul className="text-xs space-y-1.5">
            {data.timelines.rewards.slice(0, 4).map((r: any, i: number) => (
              <li key={i} className="flex items-center justify-between">
                <span className="truncate">{r.rewards?.name}</span>
                <span className="text-muted-foreground">{formatDistanceToNowStrict(new Date(r.created_at))} ago</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function Row9Timelines({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <TimelineCard title="Recent Achievements" icon={<Trophy className="h-4 w-4 text-trophy" />} items={data.timelines.achievements} keyName="achievements" dateField="unlocked_at" />
      <TimelineCard title="Recent Badges" icon={<Shield className="h-4 w-4 text-secondary" />} items={data.timelines.badges} keyName="badges" dateField="earned_at" />
      <TimelineCard title="Recent Trophies" icon={<Award className="h-4 w-4 text-trophy" />} items={data.timelines.trophies} keyName="trophies" dateField="earned_at" />
      <TimelineCard title="Recent Rewards" icon={<Gift className="h-4 w-4 text-primary" />} items={data.timelines.rewards} keyName="rewards" dateField="created_at" />
    </div>
  );
}

export function Row10AI() {
  const cards: { title: string; copy: string }[] = [
    { title: "AI Growth Analysis", copy: "Run growth analysis to surface XP velocity, achievement gaps, and at-risk users." },
    { title: "AI Recommendation", copy: "Generate personalized next-best-actions based on current progression." },
    { title: "AI Achievement Suggestions", copy: "Let AI propose achievements matched to your behavior model." },
    { title: "AI Reward Suggestions", copy: "Get curated reward suggestions tuned to wallet balances and history." },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.title} title={c.title} icon={<Sparkles className="h-4 w-4 text-secondary" />}>
          <div className="text-xs text-muted-foreground">{c.copy}</div>
          <button className="mt-3 text-xs font-medium text-primary hover:underline">Run analysis →</button>
        </Card>
      ))}
    </div>
  );
}

export function Row11Heatmaps({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <HeatmapCard title="Achievement Heatmap" data={data.timelines.achievements} dateField="unlocked_at" />
      <HeatmapCard title="Activity Heatmap" data={data.xpRecent} dateField="created_at" />
      <HeatmapCard title="Engagement Heatmap" data={data.timelines.badges} dateField="earned_at" />
      <HeatmapCard title="Growth Heatmap" data={data.timelines.trophies} dateField="earned_at" />
    </div>
  );
}

export function Row12Analytics({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <Card title="Achievement Analytics" icon={<Activity className="h-4 w-4 text-trophy" />}><MiniSpark count={data.totals.achievementsEarned} max={Math.max(data.totals.achievementsCatalog, 1)} label="unlock rate" /></Card>
      <Card title="XP Analytics" icon={<Zap className="h-4 w-4 text-xp" />}><MiniSpark count={data.xpRecent.length} max={30} label="recent xp events" /></Card>
      <Card title="Rank Analytics" icon={<Crown className="h-4 w-4 text-legendary" />}><MiniSpark count={data.progression.currentRank?.rank_number ?? 0} max={Math.max((data.leaderboards.length || 1), 10)} label="rank standing" /></Card>
      <Card title="Reward Analytics" icon={<Gift className="h-4 w-4 text-primary" />}><MiniSpark count={data.economy.claims.length} max={20} label="claim activity" /></Card>
    </div>
  );
}

export function Row13Halls({ data }: { data: Data }) {
  const h = data.halls ?? { fame: [], champions: [], top100: [], legends: [] };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <HallCard title="Hall of Fame" icon={<Star className="h-4 w-4 text-trophy" />} entries={h.fame} emptyHint="Hall of Fame populates from leaderboard champions." />
      <HallCard title="Champions Wall" icon={<Crown className="h-4 w-4 text-legendary" />} entries={h.champions} emptyHint="Configure champion rules in the Leaderboards page." />
      <HallCard title="Top 100" icon={<BarChart3 className="h-4 w-4 text-primary" />} entries={h.top100.slice(0, 8)} subtitle={h.top100.length ? `${h.top100.length} ranked` : undefined} emptyHint="No entries yet." />
      <HallCard title="Legends Board" icon={<Award className="h-4 w-4 text-mythic" />} entries={h.legends} emptyHint="Awaiting first legendary milestone." />
    </div>
  );
}

function HallCard({ title, icon, entries, emptyHint, subtitle }: { title: string; icon: React.ReactNode; entries: any[]; emptyHint: string; subtitle?: string }) {
  return (
    <Card title={title} icon={icon}>
      {subtitle && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{subtitle}</div>}
      {entries.length === 0 ? <EmptyHint>{emptyHint}</EmptyHint> : (
        <ol className="space-y-1.5">
          {entries.map((e: any) => (
            <li key={e.user_id} className="flex items-center justify-between text-sm">
              <span className="tabular-nums text-muted-foreground w-6">#{e.rank}</span>
              <span className="flex-1 truncate ml-2">{e.profiles?.display_name ?? "Anonymous"}</span>
              <span className="tabular-nums font-mono text-xs">{fmt.format(e.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ---------- shared building blocks ---------- */

function Card({ title, icon, children, fill }: { title: string; icon: React.ReactNode; children: React.ReactNode; fill?: boolean }) {
  return (
    <div className={cn("surface-card p-4", fill && "h-full")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        {icon}<span className="uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function RarityChip({ name, rarity }: { name?: string; rarity?: string }) {
  const ring: Record<string, string> = {
    common: "border-border",
    rare: "ring-rarity-rare",
    epic: "ring-rarity-epic",
    legendary: "ring-rarity-legendary",
    mythic: "ring-rarity-mythic",
  };
  return (
    <div title={name} className={cn("aspect-square rounded-lg bg-card flex items-center justify-center border", ring[rarity ?? "common"] ?? "border-border")}>
      <Shield className={cn("h-4 w-4", rarityClass(rarity))} />
    </div>
  );
}

function rarityClass(r?: string) {
  return r === "rare" ? "rarity-rare" : r === "epic" ? "rarity-epic" : r === "legendary" ? "rarity-legendary" : r === "mythic" ? "rarity-mythic" : "rarity-common";
}
function tierColor(t?: string) {
  if (t === "platinum") return "text-info";
  if (t === "gold") return "text-trophy";
  if (t === "silver") return "text-muted-foreground";
  return "text-legendary";
}
function statusBadge(s: string) {
  if (s === "approved") return "bg-info/15 text-info";
  if (s === "fulfilled") return "bg-success/15 text-success";
  if (s === "rejected") return "bg-destructive/15 text-destructive";
  return "bg-warning/15 text-warning";
}

function LeaderboardCard({ title, icon, entries, hint }: { title: string; icon: React.ReactNode; entries: any[]; hint?: string }) {
  return (
    <Card title={title} icon={icon}>
      {entries.length === 0 ? <EmptyHint>{hint}</EmptyHint> : (
        <ol className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.user_id} className="flex items-center justify-between text-sm">
              <span className="tabular-nums text-muted-foreground w-6">#{e.rank}</span>
              <span className="flex-1 truncate ml-2">{e.profiles?.display_name ?? "Anonymous"}</span>
              <span className="tabular-nums font-mono">{fmt.format(e.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function MissionsCard({ title, cadenceLabel, icon, items }: { title: string; cadenceLabel: string; icon: React.ReactNode; items: any[] }) {
  return (
    <Card title={title} icon={icon}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{cadenceLabel}</div>
      {items.length === 0 ? <EmptyHint>No active missions. Admins can add some in the Missions page.</EmptyHint> : (
        <ul className="space-y-2">
          {items.slice(0, 4).map((m: any) => (
            <li key={m.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{m.name}</span>
                <span className="text-xs text-xp tabular-nums">+{m.xp_reward}</span>
              </div>
              <div className="mt-1.5"><ProgressBar pct={0} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ListCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: any[] }) {
  return (
    <Card title={title} icon={icon}>
      {items.length === 0 ? <EmptyHint>Nothing active.</EmptyHint> : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((i: any) => (
            <li key={i.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{i.name}</span>
              {"xp_reward" in i && <span className="text-xs text-xp tabular-nums">+{i.xp_reward}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TimelineCard({ title, icon, items, keyName, dateField }: { title: string; icon: React.ReactNode; items: any[]; keyName: string; dateField: string }) {
  return (
    <Card title={title} icon={icon}>
      {items.length === 0 ? <EmptyHint>Nothing recent.</EmptyHint> : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((it: any, i: number) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{it[keyName]?.name ?? "—"}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {it[dateField] ? `${formatDistanceToNowStrict(new Date(it[dateField]))} ago` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HeatmapCard({ title, data, dateField }: { title: string; data: any[]; dateField: string }) {
  // 7x12 grid (last ~12 weeks)
  const cells = Array.from({ length: 84 }).map((_, i) => {
    const day = new Date(); day.setDate(day.getDate() - (83 - i));
    const dayKey = day.toISOString().slice(0, 10);
    const count = data.filter((d) => d[dateField]?.slice(0, 10) === dayKey).length;
    return { i, count };
  });
  const max = Math.max(1, ...cells.map((c) => c.count));
  return (
    <Card title={title} icon={<Activity className="h-4 w-4 text-primary" />}>
      <div className="grid grid-cols-12 gap-[3px] mt-1">
        {cells.map((c) => (
          <div
            key={c.i}
            className="aspect-square rounded-[2px]"
            style={{
              background: c.count === 0
                ? "color-mix(in oklab, var(--color-muted) 60%, transparent)"
                : `color-mix(in oklab, var(--color-primary) ${20 + (c.count / max) * 70}%, transparent)`,
              boxShadow: c.count >= max && max > 0 ? "0 0 6px var(--color-primary)" : undefined,
            }}
            title={`${c.count} on day ${c.i}`}
          />
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">Last 12 weeks</div>
    </Card>
  );
}

function MiniSpark({ count, max, label }: { count: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((count / Math.max(max, 1)) * 100));
  return (
    <div>
      <div className="text-3xl font-bold tabular-nums">{count}</div>
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <ProgressBar pct={pct} gradient="var(--gradient-primary)" />
    </div>
  );
}

export { SectionTitle };
