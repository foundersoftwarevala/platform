import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Lock, ShieldCheck, QrCode, Download, Share2, Copy,
  CheckCircle2, Zap, Search as SearchIcon, Sparkles, Trophy, Crown,
  Award as AwardIcon, ChevronRight, MapPin, Calendar,
} from "lucide-react";
import type { RoleKey, RoleConfig } from "@/lib/roles";
import {
  AMS_SECTIONS, AMS_ROLE, LEVELS, levelForXp,
  loadAmsState, saveAmsState, sectionsForLevel,
  type AmsSectionKey, type AmsUserState, type AmsRoleConfig, type AmsItem,
} from "@/lib/ams-engine";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/dashboard/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ────────────────────── ROOT ────────────────────── */

export function AMSEngine({ role, onBack }: { role: RoleConfig; onBack: () => void }) {
  const cfg = AMS_ROLE[role.key as RoleKey];
  const [state, setState] = useState<AmsUserState>(() => loadAmsState(role.key as RoleKey));
  const [section, setSection] = useState<AmsSectionKey>("home");
  const [search, setSearch] = useState("");

  useEffect(() => { saveAmsState(role.key as RoleKey, state); }, [role.key, state]);

  const lvl = levelForXp(state.xp);
  const nextBand = LEVELS.find((l) => l.level === lvl.level + 1);
  const xpInBand = state.xp - lvl.xpFrom;
  const xpBandSize = lvl.xpTo - lvl.xpFrom;
  const pct = Math.min(100, Math.round((xpInBand / Math.max(1, xpBandSize)) * 100));

  const visibleSections = useMemo(() => sectionsForLevel(lvl.level), [lvl.level]);

  const ctx: SectionCtx = {
    role, cfg, state, setState, level: lvl,
    onGoto: setSection,
  };

  return (
    <div className="space-y-5" data-ams-role={role.key}>
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{cfg.eyebrow}</div>
          <h1 className="text-xl md:text-2xl font-semibold">Achievement Management System</h1>
        </div>
      </div>

      <AMSHeader ctx={ctx} pct={pct} nextBandLabel={nextBand?.label ?? "Max Tier"} />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        <NavRail
          sections={visibleSections}
          current={section}
          onSelect={setSection}
          search={search}
          onSearch={setSearch}
        />
        <div key={section} className="min-w-0 ams-section-enter">
          {renderSection(section, ctx, search)}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── TYPES / CTX ────────────────────── */

type SectionCtx = {
  role: RoleConfig;
  cfg: AmsRoleConfig;
  state: AmsUserState;
  setState: React.Dispatch<React.SetStateAction<AmsUserState>>;
  level: (typeof LEVELS)[number];
  onGoto: (k: AmsSectionKey) => void;
};

function renderSection(k: AmsSectionKey, ctx: SectionCtx, search: string) {
  switch (k) {
    case "home":          return <HomeSection ctx={ctx} />;
    case "journey":       return <JourneySection ctx={ctx} />;
    case "passport":      return <PassportSection ctx={ctx} />;
    case "identity":      return <IdentitySection ctx={ctx} />;
    case "achievements":  return <AchievementsSection ctx={ctx} />;
    case "awards":        return <ItemGridSection ctx={ctx} kind="awards" />;
    case "badges":        return <ItemGridSection ctx={ctx} kind="badges" />;
    case "trophies":      return <ItemGridSection ctx={ctx} kind="trophies" />;
    case "certificates":  return <CertificatesSection ctx={ctx} />;
    case "collections":   return <CollectionsSection ctx={ctx} />;
    case "missions":      return <MissionsSection ctx={ctx} />;
    case "rewards":       return <RewardsSection ctx={ctx} />;
    case "leaderboard":   return <LeaderboardSection ctx={ctx} />;
    case "hall-of-fame":  return <LockedSection title="Hall Of Fame" reason="Unlock at Level 5" ctx={ctx} minLevel={5} />;
    case "legacy":        return <LockedSection title="Legacy Archive" reason="Unlock at Level 4" ctx={ctx} minLevel={4} />;
    case "timeline":      return <TimelineSection ctx={ctx} />;
    case "notifications": return <NotificationsSection ctx={ctx} />;
    case "history":       return <HistorySection ctx={ctx} />;
    case "profile":       return <ProfileSection ctx={ctx} />;
    case "search":        return <SearchSection ctx={ctx} query={search} />;
  }
}

/* ────────────────────── HEADER ────────────────────── */

function AMSHeader({ ctx, pct, nextBandLabel }: { ctx: SectionCtx; pct: number; nextBandLabel: string }) {
  const { cfg, state, level, role } = ctx;
  const nextUnlock = AMS_SECTIONS.find((s) => s.unlockLevel > level.level);
  const currentMission = cfg.missions[0];

  return (
    <div
      className="rounded-2xl border border-border p-5 md:p-6 relative overflow-hidden ams-header-in ams-shine"
      style={{ background: cfg.gradient }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(600px 200px at 90% -10%, oklch(1 0 0 / 0.15), transparent)" }} />
      <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-5 items-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white/90 border border-white/20"
          style={{ background: "oklch(1 0 0 / 0.12)" }}
          aria-label={`${role.name} avatar`}
        >
          {role.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/70">{cfg.eyebrow}</div>
          <div className="mt-0.5 text-xl md:text-2xl font-semibold text-white truncate">{role.name} · {level.label}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            <Chip>Passport {state.passportId}</Chip>
            <Chip>Level {level.level}</Chip>
            <Chip>Rank —</Chip>
            <Chip>{state.xp.toLocaleString()} XP</Chip>
            <Chip>Trust {state.trustScore}</Chip>
            <Chip>Reputation {state.reputation}</Chip>
            <Chip tone={state.verified ? "success" : "muted"}>
              <ShieldCheck className="h-3 w-3" /> {state.verified ? "Verified" : "Unverified"}
            </Chip>
          </div>
          <div className="mt-3 max-w-md">
            <div className="flex items-center justify-between text-[11px] text-white/80">
              <span>Progress to {nextBandLabel}</span><span>{pct}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-white/85 ams-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="hidden md:block text-right space-y-2">
          {currentMission && (
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 max-w-[220px]">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Current Mission</div>
              <div className="text-sm text-white font-medium truncate">{currentMission.label}</div>
              <div className="text-[11px] text-white/80">+{currentMission.xp} XP · {currentMission.cadence}</div>
            </div>
          )}
          {nextUnlock && (
            <div className="rounded-xl border border-white/15 bg-white/10 p-3 max-w-[220px]">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Next Unlock</div>
              <div className="text-sm text-white font-medium truncate">{nextUnlock.label}</div>
              <div className="text-[11px] text-white/80">🔒 Level {nextUnlock.unlockLevel}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "success" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-white/90",
      tone === "success" ? "border-white/30 bg-white/15" : "border-white/15 bg-white/8",
    )}>
      {children}
    </span>
  );
}

/* ────────────────────── NAV ────────────────────── */

function NavRail({
  sections, current, onSelect, search, onSearch,
}: {
  sections: (typeof AMS_SECTIONS[number] & { unlocked: boolean })[];
  current: AmsSectionKey;
  onSelect: (k: AmsSectionKey) => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const groups: Record<string, typeof sections> = { core:[], identity:[], progress:[], collection:[], social:[], meta:[] };
  for (const s of sections) groups[s.group].push(s);

  return (
    <aside className="rounded-2xl border border-border bg-surface p-3 lg:sticky lg:top-4 h-fit">
      <div className="relative mb-3">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { onSearch(e.target.value); if (e.target.value.trim()) onSelect("search"); }}
          placeholder="Search AMS…"
          className="pl-8 h-8 text-xs"
          aria-label="Search Achievement Management System"
        />
      </div>
      {(["core","identity","progress","collection","social","meta"] as const).map((g) => (
        groups[g].length > 0 && (
          <div key={g} className="mb-3">
            <div className="px-2 mb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{g}</div>
            <div className="space-y-0.5">
              {groups[g].map((s) => {
                const active = current === s.key;
                const disabled = !s.unlocked;
                return (
                  <button
                    key={s.key}
                    onClick={() => !disabled && onSelect(s.key)}
                    disabled={disabled}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "ams-nav-item w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left",
                      active ? "bg-brand/15 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {disabled ? <Lock className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                    <span className="flex-1 truncate">{s.label}</span>
                    {disabled && <span className="text-[9px]">L{s.unlockLevel}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )
      ))}
    </aside>
  );
}

/* ────────────────────── LAYOUT HELPERS ────────────────────── */

function SectionShell({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, message, cta, onCta, icon: Icon = Sparkles }: {
  title: string; message: string; cta?: string; onCta?: () => void; icon?: any;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
        <Icon className="h-7 w-7" />
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{message}</p>
      {cta && onCta && <Button size="sm" className="mt-4" onClick={onCta}>{cta}</Button>}
    </div>
  );
}

function StatCard({ label, value, hint, tone = "brand" }: { label: string; value: React.ReactNode; hint?: string; tone?: "brand" | "success" | "warning" | "cyan" | "violet" }) {
  const toneCls: Record<string, string> = {
    brand: "bg-brand/12 text-brand",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    cyan: "bg-[oklch(0.78_0.16_210)]/12 text-[oklch(0.78_0.16_210)]",
    violet: "bg-[oklch(0.7_0.18_300)]/12 text-[oklch(0.7_0.18_300)]",
  };
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3 ams-lift ams-press">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", toneCls[tone])}>
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

/* ────────────────────── HOME ────────────────────── */

function HomeSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state, level, onGoto } = ctx;
  const currentMission = cfg.missions[0];
  const nextUnlock = AMS_SECTIONS.find((s) => s.unlockLevel > level.level);
  const recentAward = state.earnedAwards.length > 0
    ? cfg.awards.find((a) => a.key === state.earnedAwards[state.earnedAwards.length - 1])
    : null;
  const nextAward = cfg.awards.find((a) => !state.earnedAwards.includes(a.key) && (a.visibleAtLevel ?? 1) <= level.level + 1);

  return (
    <SectionShell title="Home" subtitle={`Today · ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ams-stagger">
        <StatCard label="Today"   value="0 XP" hint="No activity yet" tone="brand" />
        <StatCard label="This Week"  value="0 XP" tone="cyan" />
        <StatCard label="This Month" value="0 XP" tone="violet" />
        <StatCard label="Current Level" value={`L${level.level} · ${level.label}`} tone="success" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Mission</div>
          {currentMission ? (
            <>
              <div className="mt-1 font-medium">{currentMission.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{currentMission.detail}</div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => onGoto("missions")}>
                  Go to Missions <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
                <span className="text-[11px] text-muted-foreground">+{currentMission.xp} XP · {currentMission.cadence}</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">No active missions.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Goal</div>
          <div className="mt-1 font-medium">Reach {LEVELS[level.level]?.label ?? "Max"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Earn XP through missions & achievements.</div>
          <div className="mt-3">
            <Progress value={Math.min(100, Math.round(((state.xp - level.xpFrom) / Math.max(1, level.xpTo - level.xpFrom)) * 100))} />
            <div className="mt-1 text-[11px] text-muted-foreground">{state.xp - level.xpFrom} / {level.xpTo - level.xpFrom} XP this tier</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent Achievement</div>
          {recentAward ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center"><AwardIcon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-medium truncate">{recentAward.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">+{recentAward.xp} XP</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">No achievements yet — complete missions to earn your first.</div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Unlock</div>
          {nextUnlock ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-surface-2 text-muted-foreground flex items-center justify-center"><Lock className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-medium truncate">{nextUnlock.label}</div>
                <div className="text-[11px] text-muted-foreground">Unlocks at Level {nextUnlock.unlockLevel}</div>
              </div>
            </div>
          ) : nextAward ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center"><Sparkles className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-medium truncate">{nextAward.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{nextAward.requirement}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">All features unlocked.</div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/* ────────────────────── JOURNEY ────────────────────── */

function JourneySection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, level } = ctx;
  return (
    <SectionShell title="Career Journey" subtitle={`Your path as a ${cfg.subject}.`}>
      <ol className="relative border-s border-border ms-2 space-y-4">
        {cfg.journey.map((s) => {
          const done = level.level >= s.atLevel;
          const current = level.level === s.atLevel || (!cfg.journey.some((x) => x.atLevel === level.level) && s.atLevel <= level.level);
          return (
            <li key={s.key} className="ps-5">
              <span className={cn(
                "absolute -start-[7px] h-3.5 w-3.5 rounded-full border-2",
                done ? "bg-brand border-brand" : "bg-surface border-border",
              )} />
              <div className="rounded-xl border border-border bg-surface-1 p-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] uppercase tracking-wider", done ? "text-brand" : "text-muted-foreground")}>
                    Level {s.atLevel} · {done ? "Completed" : current ? "In progress" : "Upcoming"}
                  </span>
                </div>
                <div className="mt-1 font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}

/* ────────────────────── PASSPORT ────────────────────── */

function PassportSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state, level, role } = ctx;
  const stamps = [
    ...state.earnedAwards.map((k) => ({ k, kind: "Award" as const, label: cfg.awards.find((a) => a.key === k)?.label ?? k })),
    ...state.earnedTrophies.map((k) => ({ k, kind: "Trophy" as const, label: cfg.trophies.find((a) => a.key === k)?.label ?? k })),
    ...state.earnedBadges.map((k) => ({ k, kind: "Badge" as const, label: cfg.badges.find((a) => a.key === k)?.label ?? k })),
  ];
  return (
    <SectionShell title="Passport" subtitle="Your digital identity across Software Vala.">
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: cfg.gradient }}>
        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center text-white">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Achievement Passport</div>
            <div className="mt-1 text-2xl font-semibold">{role.name} · {cfg.subject}</div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
              <PassRow k="Passport ID" v={state.passportId} />
              <PassRow k="Level" v={`L${level.level} · ${level.label}`} />
              <PassRow k="XP" v={state.xp.toLocaleString()} />
              <PassRow k="Joined" v={new Date(state.joinedAt).toLocaleDateString()} />
              <PassRow k="Trust" v={`${state.trustScore}/100`} />
              <PassRow k="Reputation" v={`${state.reputation}/100`} />
              <PassRow k="Status" v={state.verified ? "Verified ✓" : "Unverified"} />
              <PassRow k="Signature" v={`SV·${state.passportId.slice(-4)}`} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-32 w-32 rounded-xl bg-white/95 text-black flex items-center justify-center" aria-label="Passport QR">
              <QrCode className="h-24 w-24" />
            </div>
            <div className="text-[10px] tracking-widest text-white/80">SCAN TO VERIFY</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(state.passportId); toast.success("Passport ID copied."); }}>
          <Copy className="h-4 w-4 mr-1" /> Copy Passport ID
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast.success("Passport shared.")}><Share2 className="h-4 w-4 mr-1" /> Share</Button>
        <Button size="sm" variant="outline" onClick={() => toast.success("Passport downloaded.")}><Download className="h-4 w-4 mr-1" /> Download</Button>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Passport Stamps</div>
        {stamps.length === 0 ? (
          <EmptyState
            title="No stamps yet"
            message="Every award, badge, and trophy you earn becomes a stamp in your passport."
            cta="Explore Missions"
            onCta={() => ctx.onGoto("missions")}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {stamps.map((s) => (
              <span key={s.kind + s.k} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px]">
                <ShieldCheck className="h-3 w-3 text-brand" /> {s.kind} · {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <PassportTimeline ctx={ctx} />
    </SectionShell>
  );
}
function PassRow({ k, v }: { k: string; v: string }) {
  return (<><div className="text-white/70">{k}</div><div className="font-medium text-right">{v}</div></>);
}
function PassportTimeline({ ctx }: { ctx: SectionCtx }) {
  const { state, cfg } = ctx;
  const items = [
    { when: new Date(state.joinedAt).toLocaleDateString(), what: `Joined as ${cfg.subject}` },
    ...(state.verified ? [{ when: "—", what: "Verified account" }] : []),
    ...state.earnedAwards.map((k) => ({ when: "—", what: `Earned award · ${cfg.awards.find((a) => a.key === k)?.label ?? k}` })),
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface-1 divide-y divide-border">
      <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Passport Timeline</div>
      {items.map((i, idx) => (
        <div key={idx} className="px-4 py-3 text-sm flex items-center justify-between">
          <span>{i.what}</span><span className="text-xs text-muted-foreground">{i.when}</span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── IDENTITY ────────────────────── */

function IdentitySection({ ctx }: { ctx: SectionCtx }) {
  const { state, setState } = ctx;
  return (
    <SectionShell title="Identity" subtitle="Verification, trust and reputation scores.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ams-stagger">
        <StatCard label="Passport ID" value={state.passportId} tone="brand" />
        <StatCard label="Trust Score" value={`${state.trustScore}/100`} tone="success" hint="Increases as you complete verified actions." />
        <StatCard label="Reputation" value={`${state.reputation}/100`} tone="cyan" hint="Feedback from your community." />
        <StatCard label="Status" value={state.verified ? "Verified" : "Unverified"} tone={state.verified ? "success" : "warning"} />
      </div>
      <div className="rounded-2xl border border-border bg-surface-1 p-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <div className="font-medium">Digital Signature</div>
          <div className="text-xs text-muted-foreground">Every asset issued to you is signed with this key.</div>
          <div className="mt-2 font-mono text-xs bg-surface-2 rounded-md px-2 py-1 inline-block">SV·SIG·{state.passportId}</div>
        </div>
        {!state.verified ? (
          <Button size="sm" onClick={() => { setState((s) => ({ ...s, verified: true, trustScore: Math.max(s.trustScore, 40), reputation: Math.max(s.reputation, 30) })); toast.success("Identity verified."); }}>
            <ShieldCheck className="h-4 w-4 mr-1" /> Verify Identity
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-success text-sm"><CheckCircle2 className="h-4 w-4" /> Verified</span>
        )}
      </div>
    </SectionShell>
  );
}

/* ────────────────────── ACHIEVEMENTS ────────────────────── */

function AchievementsSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state, level, onGoto } = ctx;
  const all = [
    ...cfg.awards.map((a) => ({ ...a, kind: "Award" as const, earned: state.earnedAwards.includes(a.key) })),
    ...cfg.trophies.map((a) => ({ ...a, kind: "Trophy" as const, earned: state.earnedTrophies.includes(a.key) })),
  ];
  const visible = all.filter((x) => (x.visibleAtLevel ?? 1) <= level.level + 1);
  const earned = visible.filter((x) => x.earned);
  const upcoming = visible.filter((x) => !x.earned);

  return (
    <SectionShell title="Achievements" subtitle="Only unlocked achievements appear here — locked ones are blurred.">
      {earned.length === 0 && upcoming.length === 0 ? (
        <EmptyState title="Nothing yet" message="Complete missions to earn your first achievement." cta="Go to Missions" onCta={() => onGoto("missions")} />
      ) : (
        <>
          {earned.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Unlocked</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 ams-stagger">
                {earned.map((a) => <ItemCard key={a.kind + a.key} item={a} earned />)}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 mt-2">Locked</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 ams-stagger">
                {upcoming.map((a) => <ItemCard key={a.kind + a.key} item={a} earned={false} />)}
              </div>
            </div>
          )}
        </>
      )}
    </SectionShell>
  );
}

function ItemCard({ item, earned }: { item: AmsItem & { kind?: string }; earned: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 relative overflow-hidden ams-lift ams-press",
      earned ? "border-brand/40 bg-brand/5" : "border-border bg-surface-1",
    )}>
      {!earned && <div className="absolute inset-0 backdrop-blur-[2px] bg-surface-1/40 pointer-events-none" />}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center",
            earned ? "bg-brand/15 text-brand" : "bg-surface-2 text-muted-foreground")}>
            {earned ? <Trophy className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
          </div>
          {item.kind && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.kind}</span>}
        </div>
        <div className="mt-2 font-medium">{item.label}</div>
        <div className="text-[11px] text-muted-foreground">{item.requirement}</div>
        <div className={cn("mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full",
          earned ? "bg-success/15 text-success" : "bg-surface-2 text-muted-foreground")}>
          {earned ? "Unlocked" : "Locked"} · +{item.xp} XP
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── AWARDS / BADGES / TROPHIES (unified grid) ────────────────────── */

function ItemGridSection({ ctx, kind }: { ctx: SectionCtx; kind: "awards" | "badges" | "trophies" }) {
  const { cfg, state, level, onGoto } = ctx;
  const items = cfg[kind];
  const earnedSet =
    kind === "awards"   ? state.earnedAwards
  : kind === "badges"   ? state.earnedBadges
  : state.earnedTrophies;

  const visible = items.filter((i) => (i.visibleAtLevel ?? 1) <= level.level + 1);
  const titleMap = { awards: "Awards", badges: "Badges", trophies: "Trophies" } as const;
  const subMap   = {
    awards:   `Role-specific awards for a ${cfg.subject}.`,
    badges:   `Distinct ${cfg.subject.toLowerCase()} badges — never reused across roles.`,
    trophies: `Unique ${cfg.subject.toLowerCase()} trophies.`,
  } as const;

  return (
    <SectionShell title={titleMap[kind]} subtitle={subMap[kind]}>
      {visible.length === 0 ? (
        <EmptyState title={`No ${titleMap[kind].toLowerCase()} available yet`} message="Level up to reveal more."
          cta="View Missions" onCta={() => onGoto("missions")} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 ams-stagger">
          {visible.map((i) => (
            <ItemCard key={i.key} item={i} earned={earnedSet.includes(i.key)} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

/* ────────────────────── CERTIFICATES ────────────────────── */

function CertificatesSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state, level, onGoto } = ctx;
  const visible = cfg.certificates.filter((c) => (c.visibleAtLevel ?? 1) <= level.level + 1);
  if (visible.length === 0) {
    return <SectionShell title="Certificates"><EmptyState title="No certificates yet" message="Certificates are issued as you reach higher tiers." cta="Go to Missions" onCta={() => onGoto("missions")} icon={ShieldCheck} /></SectionShell>;
  }
  return (
    <SectionShell title="Certificates" subtitle="Digitally signed, verifiable via your Passport ID.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((c) => {
          const earned = state.earnedCertificates.includes(c.key);
          return (
            <div key={c.key} className={cn("rounded-2xl border p-4", earned ? "border-brand/40 bg-brand/5" : "border-border bg-surface-1 opacity-80")}>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                  {earned ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Certificate</div>
              </div>
              <div className="mt-2 font-medium">{c.label}</div>
              <div className="text-[11px] text-muted-foreground">{c.requirement}</div>
              <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                Preview · signed by Software Vala · verify with {state.passportId}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" disabled={!earned} onClick={() => toast.success("Certificate downloaded.")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button size="sm" variant="outline" disabled={!earned} onClick={() => toast.success("Verification link opened.")}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verify
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* ────────────────────── COLLECTIONS ────────────────────── */

function CollectionsSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state } = ctx;
  const rows = [
    { label: "Award Collection",         total: cfg.awards.length,       have: state.earnedAwards.length,       to: "awards" as AmsSectionKey },
    { label: "Badge Collection",         total: cfg.badges.length,       have: state.earnedBadges.length,       to: "badges" as AmsSectionKey },
    { label: "Trophy Collection",        total: cfg.trophies.length,     have: state.earnedTrophies.length,     to: "trophies" as AmsSectionKey },
    { label: "Certificate Collection",   total: cfg.certificates.length, have: state.earnedCertificates.length, to: "certificates" as AmsSectionKey },
    { label: "Passport Stamp Collection",total: cfg.awards.length + cfg.badges.length + cfg.trophies.length, have: state.earnedAwards.length + state.earnedBadges.length + state.earnedTrophies.length, to: "passport" as AmsSectionKey },
  ];
  return (
    <SectionShell title="Collections" subtitle="Everything you've collected as a ${cfg.subject}.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ams-stagger">
        {rows.map((r) => {
          const pct = r.total > 0 ? Math.round((r.have / r.total) * 100) : 0;
          return (
            <button key={r.label} onClick={() => ctx.onGoto(r.to)} className="rounded-2xl border border-border bg-surface-1 p-4 text-left ams-lift ams-press">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
              <div className="mt-1 text-lg font-semibold">{r.have} <span className="text-muted-foreground text-sm">/ {r.total}</span></div>
              <div className="mt-2"><Progress value={pct} /></div>
              <div className="mt-1 text-[11px] text-muted-foreground">{pct}% complete</div>
            </button>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* ────────────────────── MISSIONS ────────────────────── */

function MissionsSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state, setState } = ctx;
  const [tab, setTab] = useState<"daily"|"weekly"|"monthly"|"special"|"founder"|"seasonal">("daily");
  const filtered = cfg.missions.filter((m) => m.cadence === tab);

  function complete(key: string, xp: number) {
    if (state.earnedMissions.includes(key)) return;
    setState((s) => ({
      ...s,
      earnedMissions: [...s.earnedMissions, key],
      xp: s.xp + xp,
      trustScore: Math.min(100, s.trustScore + 2),
      reputation: Math.min(100, s.reputation + 1),
    }));
    toast.success(`+${xp} XP earned.`);
  }

  return (
    <SectionShell title="Missions" subtitle="Complete missions to earn XP and level up.">
      <div className="flex flex-wrap gap-2">
        {(["daily","weekly","monthly","special","founder","seasonal"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-3 py-1.5 rounded-full text-xs border capitalize transition",
              tab === t ? "bg-brand text-brand-foreground border-brand" : "border-border bg-surface-1 hover:bg-surface-2")}>
            {t}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={`No ${tab} missions`} message="Check back when the next cycle releases." icon={Zap} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((m) => {
            const done = state.earnedMissions.includes(m.key);
            return (
              <div key={m.key} className="rounded-2xl border border-border bg-surface-1 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize">{m.cadence}</span>
                  <span className="text-[11px] text-brand font-medium">+{m.xp} XP</span>
                </div>
                <div className="mt-1 font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.detail}</div>
                <div className="mt-3">
                  <Button size="sm" disabled={done} onClick={() => complete(m.key, m.xp)}>
                    {done ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Completed</> : "Mark Complete"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

/* ────────────────────── REWARDS ────────────────────── */

function RewardsSection({ ctx }: { ctx: SectionCtx }) {
  const { cfg, state, level, setState, onGoto } = ctx;
  const catalog = [
    { key:"reward-lvl2", label:`${cfg.subject} Kit`,      req:"Reach Level 2", atLevel:2 },
    { key:"reward-lvl3", label:"Priority Support Pass",   req:"Reach Level 3", atLevel:3 },
    { key:"reward-lvl4", label:"Featured Placement Week", req:"Reach Level 4", atLevel:4 },
    { key:"reward-lvl5", label:"Elite Merchandise Box",   req:"Reach Level 5", atLevel:5 },
  ];
  function claim(k: string) {
    if (state.claimedRewards.includes(k)) return;
    setState((s) => ({ ...s, claimedRewards: [...s.claimedRewards, k] }));
    toast.success("Reward claimed.");
  }
  return (
    <SectionShell title="Rewards" subtitle="Earn as you grow.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {catalog.map((r) => {
          const eligible = level.level >= r.atLevel;
          const claimed = state.claimedRewards.includes(r.key);
          const status = claimed ? "Claimed" : eligible ? "Available" : "Locked";
          return (
            <div key={r.key} className={cn("rounded-2xl border p-4", eligible ? "border-brand/30 bg-surface-1" : "border-border bg-surface-1 opacity-80")}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reward</span>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full",
                  claimed ? "bg-success/15 text-success" : eligible ? "bg-brand/15 text-brand" : "bg-surface-2 text-muted-foreground")}>
                  {status}
                </span>
              </div>
              <div className="mt-1 font-medium">{r.label}</div>
              <div className="text-[11px] text-muted-foreground">{r.req}</div>
              <div className="mt-3">
                <Button size="sm" disabled={!eligible || claimed} onClick={() => claim(r.key)}>
                  {claimed ? "Claimed" : eligible ? "Claim" : "Locked"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground">
        Need more XP? <button className="underline underline-offset-4" onClick={() => onGoto("missions")}>Complete missions →</button>
      </div>
    </SectionShell>
  );
}

/* ────────────────────── LEADERBOARD ────────────────────── */

function LeaderboardSection({ ctx }: { ctx: SectionCtx }) {
  const { role, state, level } = ctx;
  const [tab, setTab] = useState<"global"|"country"|"department"|"role"|"friends"|"lifetime">("global");
  const tabs = [
    { key:"global",     label:"Global",     icon: MapPin },
    { key:"country",    label:"Country",    icon: MapPin },
    { key:"department", label:"Department", icon: MapPin },
    { key:"role",       label:`${role.name}s`, icon: MapPin },
    { key:"friends",    label:"Friends",    icon: MapPin },
    { key:"lifetime",   label:"Lifetime",   icon: Calendar },
  ] as const;
  return (
    <SectionShell title="Leaderboard" subtitle={`Ranking updates as ${role.name}s across Software Vala grow.`}>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-3 py-1.5 rounded-full text-xs border transition",
              tab === t.key ? "bg-brand text-brand-foreground border-brand" : "border-border bg-surface-1 hover:bg-surface-2")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-surface-1 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 w-16">Rank</th>
              <th className="text-left px-4 py-2">{role.name}</th>
              <th className="text-left px-4 py-2">Level</th>
              <th className="text-right px-4 py-2">XP</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border bg-brand/5">
              <td className="px-4 py-3 font-semibold text-brand">—</td>
              <td className="px-4 py-3 font-medium">You</td>
              <td className="px-4 py-3">L{level.level} · {level.label}</td>
              <td className="px-4 py-3 text-right">{state.xp.toLocaleString()}</td>
            </tr>
            <tr className="border-t border-border">
              <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {tabs.find(x => x.key === tab)?.label} leaderboard — ranks appear as more {role.name.toLowerCase()}s join.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}

/* ────────────────────── LOCKED / HALL / LEGACY ────────────────────── */

function LockedSection({ title, reason, ctx, minLevel }: { title: string; reason: string; ctx: SectionCtx; minLevel: number }) {
  const eligible = ctx.level.level >= minLevel;
  if (eligible) {
    return (
      <SectionShell title={title} subtitle="Eligible — content will populate as you earn placement.">
        <EmptyState
          title={`${title} — eligible`}
          message={`You've reached the level for ${title}. Recognitions appear here as they are awarded.`}
          icon={title === "Hall Of Fame" ? Crown : Sparkles}
        />
      </SectionShell>
    );
  }
  return (
    <SectionShell title={title}>
      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-10 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-surface-2 text-muted-foreground flex items-center justify-center">
          <Lock className="h-6 w-6" />
        </div>
        <div className="mt-3 font-medium">{title}</div>
        <div className="text-sm text-muted-foreground mt-1">🔒 {reason}</div>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => ctx.onGoto("missions")}>Earn XP</Button>
      </div>
    </SectionShell>
  );
}

/* ────────────────────── TIMELINE ────────────────────── */

function TimelineSection({ ctx }: { ctx: SectionCtx }) {
  const { state, cfg, level } = ctx;
  const items: { when: string; what: string; kind: string }[] = [
    { when: new Date(state.joinedAt).toLocaleDateString(), what: `Joined as ${cfg.subject}`, kind: "Joined" },
    ...(state.verified ? [{ when: "—", what: "Identity verified", kind: "Milestone" }] : []),
    ...state.earnedMissions.map((k) => {
      const m = cfg.missions.find((x) => x.key === k);
      return { when: "—", what: `Mission complete · ${m?.label ?? k}`, kind: "Mission" };
    }),
    ...state.earnedAwards.map((k) => {
      const a = cfg.awards.find((x) => x.key === k);
      return { when: "—", what: `Award earned · ${a?.label ?? k}`, kind: "Award" };
    }),
  ];
  const future = cfg.journey.filter((s) => s.atLevel > level.level).slice(0, 2);
  return (
    <SectionShell title="Professional Timeline" subtitle="Joined · Milestones · Achievements · Current · Future.">
      <div className="rounded-2xl border border-border bg-surface-1 divide-y divide-border">
        {items.map((i, idx) => (
          <div key={idx} className="px-4 py-3 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20">{i.kind}</span>
            <span className="flex-1 text-sm">{i.what}</span>
            <span className="text-xs text-muted-foreground">{i.when}</span>
          </div>
        ))}
        <div className="px-4 py-3 flex items-center gap-3 bg-brand/5">
          <span className="text-[10px] uppercase tracking-wider text-brand w-20">Current</span>
          <span className="flex-1 text-sm">Level {level.level} · {level.label}</span>
          <span className="text-xs text-muted-foreground">Now</span>
        </div>
        {future.map((f) => (
          <div key={f.key} className="px-4 py-3 flex items-center gap-3 opacity-70">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20">Future</span>
            <span className="flex-1 text-sm">{f.label} · {f.detail}</span>
            <span className="text-xs text-muted-foreground">L{f.atLevel}</span>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ────────────────────── NOTIFICATIONS / HISTORY / PROFILE ────────────────────── */

function NotificationsSection({ ctx }: { ctx: SectionCtx }) {
  const { state, cfg } = ctx;
  const notes = [
    ...state.earnedMissions.slice(-5).reverse().map((k) => {
      const m = cfg.missions.find((x) => x.key === k);
      return { title: "Mission completed", detail: m?.label ?? k, xp: m?.xp };
    }),
  ];
  if (notes.length === 0) {
    return <SectionShell title="Notifications"><EmptyState title="All caught up" message="You'll see mission completions, awards, and rewards here." icon={CheckCircle2} /></SectionShell>;
  }
  return (
    <SectionShell title="Notifications">
      <div className="rounded-2xl border border-border bg-surface-1 divide-y divide-border">
        {notes.map((n, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between">
            <div><div className="text-sm font-medium">{n.title}</div><div className="text-xs text-muted-foreground">{n.detail}</div></div>
            {n.xp && <span className="text-[11px] text-brand">+{n.xp} XP</span>}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function HistorySection({ ctx }: { ctx: SectionCtx }) {
  const { state, cfg, setState } = ctx;
  const rows = [
    ...state.earnedMissions.map((k) => ({ kind: "Mission", label: cfg.missions.find((m) => m.key === k)?.label ?? k })),
    ...state.earnedAwards.map((k)  => ({ kind: "Award",   label: cfg.awards.find((a) => a.key === k)?.label ?? k })),
    ...state.earnedBadges.map((k)  => ({ kind: "Badge",   label: cfg.badges.find((a) => a.key === k)?.label ?? k })),
    ...state.claimedRewards.map((k)=> ({ kind: "Reward",  label: k })),
  ];
  return (
    <SectionShell
      title="History"
      subtitle="Every XP-earning action across your journey."
      action={rows.length > 0 && (
        <Button size="sm" variant="outline" onClick={() => { setState((s) => ({ ...s, earnedMissions: [], earnedAwards: [], earnedBadges: [], earnedTrophies: [], claimedRewards: [], xp: 0 })); toast.success("History cleared."); }}>Reset</Button>
      )}
    >
      {rows.length === 0 ? (
        <EmptyState title="No history" message="Complete missions to build your history." icon={Zap} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface-1 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr><th className="text-left px-4 py-2 w-28">Kind</th><th className="text-left px-4 py-2">Item</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border"><td className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{r.kind}</td><td className="px-4 py-2">{r.label}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

function ProfileSection({ ctx }: { ctx: SectionCtx }) {
  const { role, cfg, state, level } = ctx;
  return (
    <SectionShell title="Profile" subtitle={`Your public ${cfg.subject} profile.`}>
      <div className="rounded-2xl border border-border bg-surface-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field k="Display Name"    v={role.name} />
        <Field k="Role"            v={cfg.subject} />
        <Field k="Passport ID"     v={state.passportId} />
        <Field k="Level"           v={`L${level.level} · ${level.label}`} />
        <Field k="Lifetime XP"     v={state.xp.toLocaleString()} />
        <Field k="Joined"          v={new Date(state.joinedAt).toLocaleDateString()} />
        <Field k="Trust Score"     v={`${state.trustScore}/100`} />
        <Field k="Reputation"      v={`${state.reputation}/100`} />
        <Field k="Verification"    v={state.verified ? "Verified" : "Unverified"} />
        <Field k="Signature"       v={`SV·SIG·${state.passportId}`} />
      </div>
    </SectionShell>
  );
}
function Field({ k, v }: { k: string; v: string }) {
  return (<div className="border border-border rounded-lg px-3 py-2 bg-surface">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
    <div className="text-sm font-medium truncate">{v}</div>
  </div>);
}

/* ────────────────────── SEARCH ────────────────────── */

function SearchSection({ ctx, query }: { ctx: SectionCtx; query: string }) {
  const { cfg } = ctx;
  const q = query.trim().toLowerCase();
  const hits: { kind: string; label: string; hint: string }[] = [];
  if (q) {
    for (const a of cfg.awards)       if (a.label.toLowerCase().includes(q)) hits.push({ kind:"Award",       label:a.label, hint:a.requirement });
    for (const b of cfg.badges)       if (b.label.toLowerCase().includes(q)) hits.push({ kind:"Badge",       label:b.label, hint:b.requirement });
    for (const t of cfg.trophies)     if (t.label.toLowerCase().includes(q)) hits.push({ kind:"Trophy",      label:t.label, hint:t.requirement });
    for (const c of cfg.certificates) if (c.label.toLowerCase().includes(q)) hits.push({ kind:"Certificate", label:c.label, hint:c.requirement });
    for (const m of cfg.missions)     if (m.label.toLowerCase().includes(q)) hits.push({ kind:"Mission",     label:m.label, hint:m.detail });
  }
  return (
    <SectionShell title="Global AMS Search" subtitle="Search awards, badges, trophies, certificates, missions & history.">
      {!q ? (
        <EmptyState title="Start typing" message="Search across your entire Achievement Management System." icon={SearchIcon} />
      ) : hits.length === 0 ? (
        <EmptyState title="No results" message={`No matches for "${query}".`} icon={SearchIcon} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface-1 divide-y divide-border">
          {hits.map((h, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{h.kind}</div>
                <div className="text-sm font-medium truncate">{h.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{h.hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
