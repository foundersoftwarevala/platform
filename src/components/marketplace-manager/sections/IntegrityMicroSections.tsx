import { ShieldCheck, Eye, History, Bookmark, Zap, PlayCircle, Share2, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import { Card, PageHeader, PillButton, StatCard } from "../ui";

function Switch({ on = false }: { on?: boolean }) {
  const [v, setV] = useState(on);
  return (
    <button
      onClick={() => setV(!v)}
      className={`relative h-5 w-9 rounded-full transition-colors ${v ? "bg-gradient-to-r from-primary to-accent" : "bg-secondary"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${v ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// ---------- INTEGRITY / "NO FAKE DATA" POLICY ----------
export function IntegritySection() {
  const pillars = [
    ["No Fake Ratings", "Ratings come from verified, completed orders only. No seeded scores."],
    ["No Fake Reviews", "Reviews require verified purchase + identity. Moderation log is auditable."],
    ["No Fake Downloads", "Download counters are tied to authenticated license deliveries."],
    ["No Fake Revenue", "Revenue is read directly from completed payment settlements."],
    ["No Fake Views", "View counters use deduped sessions, not inflated impressions."],
    ["Only Real Data", "Every surface shows '—' until live, verified data is connected."],
  ] as const;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Integrity · Locked Policy"
        title="No Fake Data Policy"
        description="Software Vala marketplace operates on verified, source-of-truth data only. These guards are enforced platform-wide."
        actions={<PillButton variant="premium">Policy is Locked</PillButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Verified Orders" value="—" tone="success" />
        <StatCard label="Verified Reviews" value="—" tone="success" />
        <StatCard label="Flagged & Removed" value="—" tone="warning" />
        <StatCard label="Audit Events" value="—" tone="premium" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pillars.map(([t, d]) => (
          <Card key={t}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success ring-1 ring-success/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{t}</div>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">Enforced</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{d}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
          <div className="text-xs text-muted-foreground">
            Numeric metrics across this console intentionally render <span className="font-mono text-foreground">—</span> until the
            live data source is wired. No placeholders, no demo numbers, no inflated counters — this is a hard rule.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------- MICRO-FEATURES MANAGER ----------
export function MicroFeaturesSection() {
  const features = [
    ["Continue Browsing", History, "Resume the last category / wall visitors were exploring."],
    ["Recently Viewed", Eye, "Last 12 products viewed, surfaced on PDP and homepage."],
    ["Save For Later", Bookmark, "Lightweight wishlist alternative without account friction."],
    ["Quick Preview", PlayCircle, "Hover or tap preview without leaving the wall."],
    ["Quick Buy", Zap, "1-click checkout for returning, verified customers."],
    ["Quick Demo", PlayCircle, "Launch the live demo sandbox in an overlay."],
    ["One-Click Share", Share2, "Native share + copy-link with UTM auto-tagging."],
    ["Add To Cart Burst", ShoppingBag, "Premium micro-animation on add-to-cart success."],
  ] as const;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Micro-Features"
        title="Storefront Micro-Interactions"
        description="The small, premium touches that make the marketplace feel alive — toggle per surface."
        actions={<PillButton variant="primary">Save Configuration</PillButton>}
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {features.map(([label, Icon, desc]) => (
          <Card key={label}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 text-accent ring-1 ring-accent/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{label}</div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Switch on />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Homepage", "PDP", "Cart", "Search"].map((s) => (
                <span key={s} className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{s}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
