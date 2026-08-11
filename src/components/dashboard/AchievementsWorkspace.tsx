import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Trophy, Award, Medal, Star, Crown, Gem, Sparkles, Flame,
  Share2, Download, QrCode, FileBadge, Globe, MapPin, Calendar,
  TrendingUp, CheckCircle2, Lock, Target, Brain, ShieldCheck,
} from "lucide-react";
import type { RoleConfig } from "@/lib/roles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/dashboard/ui/button";
import { cn } from "@/lib/utils";
import {
  ShareAssetDialog,
  type SharePayload,
  downloadPosterPng,
  downloadQrPng,
  copyQrPngToClipboard,
  copyVerifyLink,
} from "@/components/dashboard/ShareAssetDialog";

type Tab = "dashboard" | "passport" | "badges" | "trophies" | "leaderboard" | "timeline" | "certificates" | "share" | "coach";

const BADGES = [
  { key:"verified",      label:"Verified",          icon:ShieldCheck, unlocked:true,  xp:50  },
  { key:"first-sale",    label:"First Purchase",    icon:Sparkles,    unlocked:true,  xp:100 },
  { key:"top-seller",    label:"Top Seller",        icon:Star,        unlocked:false, xp:200 },
  { key:"100-orders",    label:"100 Orders",        icon:Medal,       unlocked:false, xp:250 },
  { key:"500-orders",    label:"500 Orders",        icon:Medal,       unlocked:false, xp:500 },
  { key:"1000-orders",   label:"1000 Orders",       icon:Trophy,      unlocked:false, xp:1000 },
  { key:"fast-growing",  label:"Fast Growing",      icon:Flame,       unlocked:false, xp:300 },
  { key:"market-expert", label:"Marketplace Expert",icon:Award,       unlocked:false, xp:400 },
  { key:"premium",       label:"Premium Partner",   icon:Gem,         unlocked:false, xp:750 },
  { key:"champion",      label:"Software Vala Champion", icon:Crown,  unlocked:false, xp:1500 },
];

const TROPHIES = [
  { key:"bronze",   label:"Bronze",   color:"oklch(0.6 0.12 50)",  unlocked:true  },
  { key:"silver",   label:"Silver",   color:"oklch(0.78 0.02 240)",unlocked:false },
  { key:"gold",     label:"Gold",     color:"oklch(0.82 0.18 90)", unlocked:false },
  { key:"platinum", label:"Platinum", color:"oklch(0.88 0.04 250)",unlocked:false },
  { key:"diamond",  label:"Diamond",  color:"oklch(0.85 0.12 200)",unlocked:false },
  { key:"founder",  label:"Founder",  color:"oklch(0.7 0.2 320)",  unlocked:false },
  { key:"special",  label:"Special Event", color:"oklch(0.78 0.18 30)", unlocked:false },
];

const LEADERBOARD_TABS = ["Global","Country","State","Monthly","Weekly","Lifetime","Top Revenue","Top Orders","Top Growth"] as const;

export function AchievementsWorkspace({ role, onBack }: { role: RoleConfig; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [lbTab, setLbTab] = useState<string>("Global");
  const [share, setShare] = useState<SharePayload | null>(null);

  const xpCurrent = 150;
  const xpNext = 500;
  const xpPct = Math.round((xpCurrent / xpNext) * 100);
  const milestonesDone = 6, milestonesTotal = 24;
  const milestonePct = Math.round((milestonesDone / milestonesTotal) * 100);
  const unlockedBadges = BADGES.filter(b => b.unlocked).length;
  const unlockedTrophies = TROPHIES.filter(t => t.unlocked).length;

  const partner = {
    id: "SV-2026-04812",
    level: "Silver · L3",
    joined: "Jan 12, 2026",
    rank: "#4,812 global",
    xp: "1,240",
  };

  const openShare = (p: SharePayload) => setShare(p);
  const base = (extra: Partial<SharePayload>): SharePayload => ({
    kind: "card",
    title: extra.title ?? "Achievement",
    subtitle: extra.subtitle,
    role: role.name,
    partnerId: partner.id,
    level: partner.level,
    xp: partner.xp,
    rank: partner.rank,
    accent: "#8b5cf6",
    ...extra,
  });


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{role.name} • Achievements</div>
          <h1 className="text-xl md:text-2xl font-semibold">Your Achievement Journey</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-surface-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="passport">Passport</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="trophies">Trophies</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="coach">AI Coach</TabsTrigger>
          </TabsList>
        </div>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat icon={Star}      label="Current Level" value="Level 3" tone="brand" />
            <Stat icon={Sparkles}  label="Current XP"    value={`${xpCurrent} / ${xpNext}`} tone="violet" />
            <Stat icon={TrendingUp} label="Total Points" value="1,240" tone="success" />
            <Stat icon={Crown}     label="Current Rank"  value="Silver" tone="warning" />
            <Stat icon={Award}     label="Badges"        value={`${unlockedBadges} / ${BADGES.length}`} tone="cyan" />
            <Stat icon={Globe}     label="Global Rank"   value="#4,812" tone="brand" />
            <Stat icon={MapPin}    label="Country Rank"  value="#312"   tone="success" />
            <Stat icon={MapPin}    label="State Rank"    value="#42"    tone="violet" />
            <Stat icon={Calendar}  label="Monthly Rank"  value="#128"   tone="warning" />
            <Stat icon={Trophy}    label="Lifetime Rank" value="#1,204" tone="cyan" />
          </div>

          <div className="rounded-2xl border border-border bg-surface-1 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Progress to Level 4</div>
              <div className="text-xs text-muted-foreground">{xpPct}%</div>
            </div>
            <Progress value={xpPct} />
            <div className="mt-2 text-xs text-muted-foreground">{xpNext - xpCurrent} XP to next level</div>
          </div>
        </TabsContent>

        {/* PASSPORT */}
        <TabsContent value="passport">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-surface-1 to-surface-2 p-6 max-w-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <FileBadge className="h-4 w-4" /> Achievement Passport
                </div>
                <h2 className="mt-2 text-2xl font-semibold">Software Vala {role.name}</h2>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-success">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Partner
                </div>
              </div>
              <Crown className="h-12 w-12 text-[oklch(0.82_0.18_90)]" />
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Field label="Partner ID" value={partner.id} />
              <Field label="Partner Level" value={partner.level} />
              <Field label="Joined Date" value={partner.joined} />
              <Field label="Current Rank" value={partner.rank} />
              <Field label="Lifetime XP" value={partner.xp} />
              <Field label="Milestones" value={`${milestonesDone} / ${milestonesTotal} completed`} />
              <Field label="Unlocked Badges" value={`${unlockedBadges} / ${BADGES.length}`} />
              <Field label="Unlocked Trophies" value={`${unlockedTrophies} / ${TROPHIES.length}`} />
              <Field label="Certificates" value="2 earned" />
              <Field label="Verified Status" value="Verified ✓" />
              <Field label="Next Target" value="Gold Tier" />
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Next Target — Gold Tier · XP</span>
                  <span className="text-muted-foreground">{xpPct}%</span>
                </div>
                <Progress value={xpPct} />
                <div className="mt-1 text-[11px] text-muted-foreground">{xpCurrent} / {xpNext} XP · {xpNext - xpCurrent} to go</div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Milestone Progress</span>
                  <span className="text-muted-foreground">{milestonePct}%</span>
                </div>
                <Progress value={milestonePct} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openShare(base({ kind:"poster", title:"Achievement Passport", subtitle:`${role.name} · ${partner.level}` }))}>
                <Download className="h-4 w-4 mr-1" /> Download Poster
              </Button>
              <Button size="sm" variant="outline" onClick={() => openShare(base({ kind:"card", title:"Achievement Passport", subtitle:`${role.name} · ${partner.level}` }))}>
                <Share2 className="h-4 w-4 mr-1" /> Share
              </Button>
              <Button size="sm" variant="outline" onClick={() => openShare(base({ kind:"qr", title:"Achievement Passport", subtitle:partner.id }))}>
                <QrCode className="h-4 w-4 mr-1" /> Achievement QR
              </Button>
            </div>
          </div>
        </TabsContent>


        {/* BADGES */}
        <TabsContent value="badges">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {BADGES.map((b) => (
              <div key={b.key}
                className={cn(
                  "rounded-2xl border p-4 flex flex-col items-center text-center transition",
                  b.unlocked
                    ? "border-brand/40 bg-brand/5 hover:bg-brand/10"
                    : "border-border bg-surface-1 opacity-60",
                )}>
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center mb-2",
                  b.unlocked ? "bg-brand/15 text-brand" : "bg-surface-2 text-muted-foreground",
                )}>
                  {b.unlocked ? <b.icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                </div>
                <div className="text-sm font-medium">{b.label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">+{b.xp} XP</div>
                <div className={cn(
                  "mt-2 text-[10px] px-2 py-0.5 rounded-full",
                  b.unlocked ? "bg-success/15 text-success" : "bg-surface-2 text-muted-foreground",
                )}>{b.unlocked ? "Unlocked" : "Locked"}</div>
                {b.unlocked && (
                  <Button size="sm" variant="outline" className="mt-3 h-7 text-[11px]"
                    onClick={() => openShare(base({ kind:"badge", title:`${b.label} Badge`, subtitle:`Earned · +${b.xp} XP` }))}>
                    <Share2 className="h-3 w-3 mr-1" /> Share
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* TROPHIES */}
        <TabsContent value="trophies">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {TROPHIES.map((t) => (
              <div key={t.key}
                className={cn(
                  "rounded-2xl border p-5 flex flex-col items-center text-center transition",
                  t.unlocked ? "border-border bg-surface-1" : "border-border bg-surface-1 opacity-50",
                )}>
                <Trophy className="h-14 w-14 mb-2" style={{ color: t.unlocked ? t.color : undefined }} />
                <div className="font-semibold">{t.label} Trophy</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.unlocked ? "Earned" : "Locked"}
                </div>
                {t.unlocked && (
                  <Button size="sm" variant="outline" className="mt-3 h-7 text-[11px]"
                    onClick={() => openShare(base({ kind:"trophy", title:`${t.label} Trophy`, subtitle:"Earned", accent:"#f59e0b" }))}>
                    <Share2 className="h-3 w-3 mr-1" /> Share
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* LEADERBOARD */}
        <TabsContent value="leaderboard" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {LEADERBOARD_TABS.map((l) => (
              <button key={l} onClick={() => setLbTab(l)}
                className={cn("px-3 py-1.5 rounded-full text-xs border transition",
                  lbTab === l ? "bg-brand text-brand-foreground border-brand" : "border-border bg-surface-1 hover:bg-surface-2")}>
                {l}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-surface-1 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 w-16">Rank</th>
                  <th className="text-left px-4 py-2">Partner</th>
                  <th className="text-left px-4 py-2">Level</th>
                  <th className="text-right px-4 py-2">XP</th>
                  <th className="text-right px-4 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-brand/5">
                  <td className="px-4 py-3 font-semibold text-brand">#4,812</td>
                  <td className="px-4 py-3 font-medium">You</td>
                  <td className="px-4 py-3">Silver L3</td>
                  <td className="px-4 py-3 text-right">1,240</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                      onClick={() => openShare(base({ kind:"ranking", title:`${lbTab} Rank #4,812`, subtitle:`${role.name} · Silver L3`, accent:"#22d3ee" }))}>
                      <Share2 className="h-3 w-3 mr-1" /> Share Rank
                    </Button>
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {lbTab} leaderboard — no other partners loaded yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>


        {/* TIMELINE */}
        <TabsContent value="timeline">
          <div className="rounded-2xl border border-border bg-surface-1 divide-y divide-border">
            <Timeline name="Verified Partner" date="Jan 12, 2026" xp={50}  reward="Verified Badge" />
            <Timeline name="First Purchase"   date="Jan 18, 2026" xp={100} reward="Sparkles Badge" />
            <Timeline name="Bronze Trophy"    date="Feb 02, 2026" xp={150} reward="Bronze Trophy"  cert />
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No more achievements yet — keep going!</div>
          </div>
        </TabsContent>

        {/* CERTIFICATES */}
        <TabsContent value="certificates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name:"Verified Partner Certificate", type:"Partner" },
              { name:"Bronze Tier Achievement",      type:"Achievement" },
            ].map((c) => (
              <div key={c.name} className="rounded-2xl border border-border bg-surface-1 p-5">
                <FileBadge className="h-8 w-8 text-brand" />
                <div className="mt-3 font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.type}</div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success("Opened.")}>View</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success("Downloaded.")}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success("Share link copied.")}><Share2 className="h-3.5 w-3.5 mr-1" />Share</Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* SHARE */}
        <TabsContent value="share">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              { kind:"card",    label:"Achievement Card",  icon:Award,       desc:"Compact card summary with QR." },
              { kind:"badge",   label:"Badge",             icon:ShieldCheck, desc:"Any unlocked badge with metadata." },
              { kind:"trophy",  label:"Trophy",            icon:Trophy,      desc:"Trophy proof with tier + verify." },
              { kind:"ranking", label:"Ranking",           icon:Crown,       desc:"Current global / country / monthly rank." },
              { kind:"poster",  label:"Premium Poster",    icon:Sparkles,    desc:"1080×1350 premium poster for social." },
              { kind:"qr",      label:"Achievement QR",    icon:QrCode,      desc:"Scannable verification code." },
            ] as const).map((s) => {
              const payload = base({ kind: s.kind, title: s.label, subtitle: `${role.name} · ${partner.level}` });
              return (
                <div key={s.label} className="rounded-2xl border border-border bg-surface-1 p-5">
                  <s.icon className="h-7 w-7 text-brand" />
                  <div className="mt-2 font-medium">Share {s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openShare(payload)}>
                      <Share2 className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={async () => {
                        try {
                          if (s.kind === "qr") await downloadQrPng(payload);
                          else await downloadPosterPng(payload);
                          toast.success("PNG downloaded.");
                        } catch { toast.error("Download failed."); }
                      }}>
                      <Download className="h-3.5 w-3.5 mr-1" /> PNG
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={async () => {
                        try {
                          const r = await copyQrPngToClipboard(payload);
                          toast.success(r === "image" ? "QR image copied." : "Verify link copied.");
                        } catch { toast.error("Copy failed."); }
                      }}>
                      <QrCode className="h-3.5 w-3.5 mr-1" /> Copy QR
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={async () => {
                        try { await copyVerifyLink(payload); toast.success("Verify link copied."); }
                        catch { toast.error("Copy failed."); }
                      }}>
                      <Share2 className="h-3.5 w-3.5 mr-1" /> Copy link
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>


        {/* AI COACH */}
        <TabsContent value="coach">
          <div className="rounded-2xl border border-border bg-surface-1 p-6 max-w-2xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Brain className="h-4 w-4" /> AI Coach
            </div>
            <div className="mt-3 text-base font-medium">Next Achievement — Top Seller</div>
            <p className="mt-1 text-sm text-muted-foreground">Reach 50 successful orders to unlock the Top Seller badge.</p>

            <div className="mt-4 space-y-2">
              <Requirement met label="Verified Partner" />
              <Requirement met label="First Purchase milestone" />
              <Requirement label="Complete 50 orders (you have 12)" />
              <Requirement label="Maintain >90% satisfaction (current 87%)" />
            </div>

            <div className="mt-5 rounded-xl border border-dashed border-border bg-surface-2 p-4 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 inline mr-1" />
              AI suggestions are placeholders — backend not connected.
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ShareAssetDialog open={!!share} onOpenChange={(v) => !v && setShare(null)} payload={share} />
    </div>
  );
}


function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  const toneCls: Record<string,string> = {
    brand:"text-brand bg-brand/15", success:"text-success bg-success/15",
    warning:"text-warning bg-warning/15", violet:"text-[oklch(0.78_0.18_300)] bg-[oklch(0.78_0.18_300)]/15",
    cyan:"text-[oklch(0.78_0.16_210)] bg-[oklch(0.78_0.16_210)]/15", danger:"text-danger bg-danger/15",
  };
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", toneCls[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function Timeline({ name, date, xp, reward, cert }: { name: string; date: string; xp: number; reward: string; cert?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="h-9 w-9 rounded-full bg-success/15 text-success flex items-center justify-center">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{date} • +{xp} XP • Reward: {reward}{cert ? " • Certificate" : ""}</div>
      </div>
      {cert && <Button size="sm" variant="outline" onClick={() => toast.success("Opened certificate.")}><FileBadge className="h-3.5 w-3.5 mr-1" />Cert</Button>}
    </div>
  );
}

function Requirement({ met, label }: { met?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met
        ? <CheckCircle2 className="h-4 w-4 text-success" />
        : <Target className="h-4 w-4 text-muted-foreground" />}
      <span className={met ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
