import { Camera, Star, ShieldCheck, Heart, Truck, Gauge, MessageCircle, Clock, Package, Pencil, ExternalLink, Share2, Link2, Check } from "lucide-react";
import { useState } from "react";
import type { RoleConfig } from "@/lib/roles";

type StoreProfile = {
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  rating: number | null;          // 0..5
  verified: boolean;
  health: number | null;          // 0..100
  fulfillment: number | null;
  performance: number | null;
  responseRate: number | null;
  responseTimeMins: number | null;
  shipping: number | null;
};

const EMPTY_PROFILE: StoreProfile = {
  name: "Your Store",
  logoUrl: null,
  bannerUrl: null,
  rating: null,
  verified: false,
  health: null,
  fulfillment: null,
  performance: null,
  responseRate: null,
  responseTimeMins: null,
  shipping: null,
};

export function VendorHero({ role }: { role: RoleConfig }) {
  const [profile, setProfile] = useState<StoreProfile>(EMPTY_PROFILE);
  const [editing, setEditing] = useState(false);

  function pickImage(field: "logoUrl" | "bannerUrl") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setProfile((p) => ({ ...p, [field]: url }));
    };
    input.click();
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border shadow-card bg-surface">
      {/* Identity strip (banner is provided by the shared profile hero above) */}
      <div className="relative px-5 md:px-8 py-5">
        <div className="flex items-end gap-4">
          {/* Logo */}
          <button
            onClick={() => pickImage("logoUrl")}
            className="relative h-24 w-24 shrink-0 rounded-2xl border-4 border-background bg-surface-2 overflow-hidden grid place-items-center shadow-card group"
            title={profile.logoUrl ? "Change store logo" : "Upload store logo"}
          >
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt="Store logo" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-black/60 text-white text-[10px] py-0.5 opacity-0 group-hover:opacity-100 transition">
              <Camera className="h-3 w-3" />
            </span>
          </button>

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
                title="Edit store name"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <VerificationBadge verified={profile.verified} onToggle={() => setProfile((p) => ({ ...p, verified: !p.verified }))} />
              <RatingBadge rating={profile.rating} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {role.banner.eyebrow} · Set up your storefront identity to start selling.
            </p>
          </div>

          <StoreActions name={profile.name} />
        </div>

        {/* Scores grid */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <ScoreCard icon={Heart}        label="Store Health"      value={profile.health}        suffix="%" tone="success" />
          <ScoreCard icon={Truck}        label="Fulfillment Score" value={profile.fulfillment}   suffix="%" tone="cyan" />
          <ScoreCard icon={Gauge}        label="Performance"       value={profile.performance}   suffix="%" tone="brand" />
          <ScoreCard icon={MessageCircle} label="Response Rate"    value={profile.responseRate}  suffix="%" tone="violet" />
          <ScoreCard icon={Clock}        label="Response Time"     value={profile.responseTimeMins} suffix=" min" tone="warning" />
          <ScoreCard icon={Truck}        label="Shipping Score"    value={profile.shipping}      suffix="%" tone="success" />
        </div>
      </div>
    </section>
  );
}

function StoreActions({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const slug = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "your-store";
  const url = `https://softwarevala.com/store/${slug}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  }
  async function share() {
    // @ts-ignore
    if (navigator.share) { try { await navigator.share({ title: name, url }); return; } catch { /* dismissed */ } }
    copy();
  }
  return (
    <div className="hidden md:flex items-center gap-2 pb-1 shrink-0">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-surface transition"
        title="Preview public store page"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Preview
      </a>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-surface transition"
        title="Copy store link"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        onClick={share}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-2.5 py-1.5 text-[11px] font-semibold shadow-glow hover:opacity-95 transition"
        title="Share store"
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
    </div>
  );
}

function VerificationBadge({ verified, onToggle }: { verified: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={verified ? "Verified store" : "Pending verification — click to toggle (demo)"}
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition " +
        (verified
          ? "bg-success/15 text-success border-success/40"
          : "bg-surface-2 text-muted-foreground border-border hover:bg-surface")
      }
    >
      <ShieldCheck className="h-3 w-3" />
      {verified ? "Verified" : "Unverified"}
    </button>
  );
}

function RatingBadge({ rating }: { rating: number | null }) {
  return (
    <span
      title={rating != null ? `${rating.toFixed(1)} / 5` : "No ratings yet"}
      className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground/80"
    >
      <Star className="h-3 w-3 text-warning" />
      {rating != null ? rating.toFixed(1) : "—"}
    </span>
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
  const pct = value == null ? 0 : Math.max(0, Math.min(100, suffix === "%" ? value : 0));
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneText}`} />
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">{display}</div>
      <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            background: "currentColor",
          }}
        />
      </div>
    </div>
  );
}
