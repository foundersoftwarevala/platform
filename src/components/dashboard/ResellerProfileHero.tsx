import { useState } from "react";
import {
  Camera, ImageIcon, ShieldCheck, Pencil, Crown, Layers, Briefcase, Trophy,
  Target as TargetIcon, Gauge, TrendingUp, RotateCcw, Trash2, Upload,
} from "lucide-react";
import defaultLogoAsset from "@/assets/dashboardLogoAsset";
import defaultBannerAsset from "@/assets/dashboardBannerAsset";

type ResellerProfile = {
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  membershipPlan: string;        // e.g. Free / Starter / Pro / Elite
  whiteLabelActive: boolean;
  partnerTier: string;           // Bronze / Silver / Gold / Platinum
  leaderboardRank: number | null;
  salesTarget: number | null;    // % of monthly target reached
  performance: number | null;    // 0..100
  conversion: number | null;     // %
  renewalScore: number | null;   // %
};

type ProfileHeroProps = {
  roleName?: string;      // e.g. "Reseller", "Author"
  accountLabel?: string;  // e.g. "Your Reseller Account"
  centerLabel?: string;   // e.g. "Reseller Center"
  bannerGradient?: string;
};

export function ResellerProfileHero({
  roleName = "Reseller",
  accountLabel,
  centerLabel,
  bannerGradient,
}: ProfileHeroProps = {}) {
  const EMPTY: ResellerProfile = {
    name: accountLabel ?? `Your ${roleName} Account`,
    logoUrl: defaultLogoAsset.url,
    bannerUrl: defaultBannerAsset.url,
    verified: false,
    membershipPlan: "—",
    whiteLabelActive: false,
    partnerTier: "—",
    leaderboardRank: null,
    salesTarget: null,
    performance: null,
    conversion: null,
    renewalScore: null,
  };
  const [profile, setProfile] = useState<ResellerProfile>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState<null | "logo" | "banner">(null);
  const defaultGradient =
    "linear-gradient(120deg, oklch(0.26 0.06 175), oklch(0.32 0.16 160), oklch(0.42 0.22 150))";
  const bannerBg = bannerGradient ?? defaultGradient;
  const centerText = centerLabel ?? `${roleName} Center`;

  function pickImage(field: "logoUrl" | "bannerUrl") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      setProfile((p) => ({ ...p, [field]: URL.createObjectURL(f) }));
    };
    input.click();
  }

  function resetImage(field: "logoUrl" | "bannerUrl") {
    setProfile((p) => ({
      ...p,
      [field]: field === "logoUrl" ? defaultLogoAsset.url : defaultBannerAsset.url,
    }));
    setMenuOpen(null);
  }

  function removeImage(field: "logoUrl" | "bannerUrl") {
    setProfile((p) => ({ ...p, [field]: null }));
    setMenuOpen(null);
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border shadow-card bg-surface">
      <div
        className="relative h-40 md:h-52 w-full overflow-hidden"
        style={
          profile.bannerUrl === defaultBannerAsset.url
            ? {
                // Professional composition: brand gradient + tiled checker watermark
                backgroundColor: "oklch(0.32 0.16 260)",
                backgroundImage: [
                  "linear-gradient(115deg, oklch(0.22 0.14 260) 0%, oklch(0.32 0.18 258) 45%, oklch(0.48 0.22 25) 100%)",
                  `url(${defaultBannerAsset.url})`,
                ].join(", "),
                backgroundSize: "cover, 96px 96px",
                backgroundRepeat: "no-repeat, repeat",
                backgroundBlendMode: "normal, soft-light",
              }
            : profile.bannerUrl
              ? { background: `center/cover no-repeat url(${profile.bannerUrl})` }
              : { background: bannerBg }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/55" />
        {profile.bannerUrl === defaultBannerAsset.url && (
          <div className="absolute inset-0 flex items-center">
            <div className="pl-6 md:pl-10 max-w-[70%]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.22_25)]" />
                Software Vala™
              </div>
              <h2 className="mt-2 text-white font-bold text-xl md:text-2xl tracking-tight drop-shadow-sm">
                Bringing Ideas to Digital Life
              </h2>
              <p className="hidden md:block mt-1 text-[12px] text-white/75">
                The Name of Trust · Enterprise Reseller & Partner Suite
              </p>
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={() => pickImage("bannerUrl")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.55_0.22_25)]/90 hover:bg-[oklch(0.55_0.22_25)] backdrop-blur border border-white/30 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-md transition"
            title="Upload banner"
          >
            <Upload className="h-3.5 w-3.5" />
            {profile.bannerUrl ? "Change" : "Upload"}
          </button>
          {profile.bannerUrl && profile.bannerUrl !== defaultBannerAsset.url && (
            <button
              onClick={() => resetImage("bannerUrl")}
              className="inline-flex items-center gap-1 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur border border-white/20 px-2 py-1.5 text-[11px] font-medium text-white transition"
              title="Reset to default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {profile.bannerUrl && (
            <button
              onClick={() => removeImage("bannerUrl")}
              className="inline-flex items-center gap-1 rounded-lg bg-black/50 hover:bg-[oklch(0.55_0.22_25)]/80 backdrop-blur border border-white/20 px-2 py-1.5 text-[11px] font-medium text-white transition"
              title="Remove banner"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative px-5 md:px-8 pb-5 -mt-12">
        <div className="flex items-end gap-4">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((m) => (m === "logo" ? null : "logo"))}
              className="logo-3d relative h-24 w-24 shrink-0 rounded-full border-4 border-background bg-white grid place-items-center group"
              title="Manage logo"
            >
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt={`${roleName} logo`} className="h-full w-full rounded-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
              <span className="absolute z-10 inset-x-0 bottom-0 grid place-items-center rounded-b-full bg-black/60 text-white text-[10px] py-1 opacity-0 group-hover:opacity-100 transition">
                <Camera className="h-3 w-3" />
              </span>
            </button>
            {menuOpen === "logo" && (
              <div
                className="absolute z-30 left-0 top-full mt-2 w-40 rounded-lg border border-border bg-popover shadow-lg overflow-hidden text-sm"
                onMouseLeave={() => setMenuOpen(null)}
              >
                <button
                  onClick={() => { pickImage("logoUrl"); setMenuOpen(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-2 text-left"
                >
                  <Upload className="h-3.5 w-3.5 text-[oklch(0.45_0.2_260)]" />
                  Upload new
                </button>
                <button
                  onClick={() => resetImage("logoUrl")}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-2 text-left"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                  Reset default
                </button>
                <button
                  onClick={() => removeImage("logoUrl")}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[oklch(0.55_0.22_25)]/10 text-[oklch(0.55_0.22_25)] text-left"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {editing ? (
                <input
                  autoFocus
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  onBlur={() => setEditing(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
                  className="bg-surface-2 border border-border rounded-md px-2 py-1 text-lg font-bold outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{profile.name}</h1>
              )}
              <button
                onClick={() => setEditing((v) => !v)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                title="Edit reseller name"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <Chip
                icon={ShieldCheck}
                label={profile.verified ? "Verified" : "Unverified"}
                tone={profile.verified ? "success" : "muted"}
                title="Verification Status"
                onClick={() => setProfile((p) => ({ ...p, verified: !p.verified }))}
              />
              <Chip icon={Crown}    label={`Plan · ${profile.membershipPlan}`}   tone="violet"  title="Membership Plan" />
              <Chip icon={Layers}   label={profile.whiteLabelActive ? "White-label ON" : "White-label OFF"} tone={profile.whiteLabelActive ? "success" : "muted"} title="White Label Status" />
              <Chip icon={Briefcase} label={`Tier · ${profile.partnerTier}`}    tone="cyan"    title="Partner Tier" />
              <Chip icon={Trophy}   label={profile.leaderboardRank == null ? "Rank · —" : `Rank · #${profile.leaderboardRank}`} tone="warning" title="Leaderboard Rank" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {centerText} · Configure your profile, plan and white-label kit to get started.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <ScoreCard icon={TargetIcon} label="Sales Target"      value={profile.salesTarget}  suffix="%" tone="brand" />
          <ScoreCard icon={Gauge}      label="Performance Score" value={profile.performance}  suffix="%" tone="success" />
          <ScoreCard icon={TrendingUp} label="Conversion Score"  value={profile.conversion}   suffix="%" tone="cyan" />
          <ScoreCard icon={RotateCcw}  label="Renewal Score"     value={profile.renewalScore} suffix="%" tone="violet" />
        </div>
      </div>
    </section>
  );
}

function Chip({
  icon: Icon, label, tone, title, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "success" | "muted" | "violet" | "cyan" | "warning";
  title?: string;
  onClick?: () => void;
}) {
  const cls = {
    success: "bg-success/15 text-success border-success/40",
    muted:   "bg-surface-2 text-muted-foreground border-border",
    violet:  "bg-[oklch(0.75_0.18_300)]/15 text-[oklch(0.78_0.18_300)] border-[oklch(0.75_0.18_300)]/30",
    cyan:    "bg-[oklch(0.78_0.16_210)]/15 text-[oklch(0.78_0.16_210)] border-[oklch(0.78_0.16_210)]/30",
    warning: "bg-warning/15 text-warning border-warning/40",
  }[tone];
  const Cmp: any = onClick ? "button" : "span";
  return (
    <Cmp
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${cls} ${onClick ? "hover:opacity-80" : ""}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Cmp>
  );
}

function ScoreCard({
  icon: Icon, label, value, suffix, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  suffix: string;
  tone: "brand" | "success" | "warning" | "violet" | "cyan";
}) {
  const toneText = {
    brand:   "text-brand",
    success: "text-success",
    warning: "text-warning",
    violet:  "text-[oklch(0.75_0.18_300)]",
    cyan:    "text-[oklch(0.78_0.16_210)]",
  }[tone];
  const display = value == null ? "—" : `${value}${suffix}`;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneText}`} />
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">{display}</div>
      <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full transition-all ${toneText}`} style={{ width: `${pct}%`, background: "currentColor" }} />
      </div>
    </div>
  );
}
