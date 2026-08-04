import {
  Image as ImageIcon, PlayCircle, Sparkles, Layers, Eye, ImagePlus,
  Type, AlignLeft, FileText, Star, Tag, FolderTree, Briefcase, GitBranch,
  KeyRound, Cpu, DollarSign, Percent, ShoppingCart, MonitorPlay, Eye as EyeIcon,
  GitCompare, Heart, Share2, Download, Phone,
} from "lucide-react";
import { PageHeader, PillButton, StatCard } from "../ui";
import { TableToolbar } from "../actions";

const VISUAL = [
  { label: "Product Thumbnail", icon: ImageIcon, hint: "1:1 · 1024px · webp" },
  { label: "Demo Thumbnail", icon: MonitorPlay, hint: "16:9 · poster" },
  { label: "Video Thumbnail", icon: PlayCircle, hint: "auto from frame" },
  { label: "Logo", icon: Sparkles, hint: "SVG · light/dark" },
  { label: "Banner", icon: ImagePlus, hint: "21:9 hero" },
  { label: "Hover Image", icon: EyeIcon, hint: "alt frame" },
  { label: "Gallery", icon: Layers, hint: "up to 12" },
  { label: "Preview Image", icon: Eye, hint: "card overlay" },
  { label: "Background", icon: ImageIcon, hint: "color/gradient/image" },
  { label: "Overlay", icon: Layers, hint: "scrim · noise" },
  { label: "Ribbon", icon: Tag, hint: "corner flag" },
];

const META = [
  { label: "Product Name", icon: Type },
  { label: "Short Description", icon: AlignLeft },
  { label: "Long Description", icon: FileText },
  { label: "Highlights", icon: Star },
  { label: "Badges", icon: Star },
  { label: "Tags", icon: Tag },
  { label: "Category", icon: FolderTree },
  { label: "Industry", icon: Briefcase },
  { label: "Version", icon: GitBranch },
  { label: "License", icon: KeyRound },
  { label: "Platform", icon: Cpu },
  { label: "Price", icon: DollarSign },
  { label: "Discount", icon: Percent },
];

const BUTTONS = [
  { label: "Buy Now", icon: ShoppingCart, tone: "primary" },
  { label: "Live Demo", icon: MonitorPlay, tone: "accent" },
  { label: "View Details", icon: Eye, tone: "ghost" },
  { label: "Compare", icon: GitCompare, tone: "ghost" },
  { label: "Wishlist", icon: Heart, tone: "ghost" },
  { label: "Share", icon: Share2, tone: "ghost" },
  { label: "Watch Video", icon: PlayCircle, tone: "ghost" },
  { label: "Screenshots", icon: ImageIcon, tone: "ghost" },
  { label: "Download Brochure", icon: Download, tone: "ghost" },
  { label: "Contact Sales", icon: Phone, tone: "premium" },
];

const TONE_CLS: Record<string,string> = {
  primary: "border-[oklch(0.62_0.20_255/0.45)] bg-[oklch(0.62_0.20_255/0.14)] text-foreground",
  accent:  "border-[oklch(0.80_0.13_192/0.45)] bg-[oklch(0.80_0.13_192/0.12)] text-foreground",
  ghost:   "border-border bg-white/[0.04] text-muted-foreground",
  premium: "border-premium/40 bg-premium/10 text-premium",
};

export function CardManagerSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Card Manager"
        title="Card Management"
        description="Govern every visual, metadata and action surface on product cards across the marketplace — homepage, walls, search, recommendations."
        actions={
          <>
            <PillButton variant="ghost">Preview Card</PillButton>
            <PillButton variant="primary">Save Template</PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Visual Fields" value={String(VISUAL.length)} />
        <StatCard label="Metadata Fields" value={String(META.length)} tone="success" />
        <StatCard label="Action Buttons" value={String(BUTTONS.length)} tone="premium" />
        <StatCard label="Card Templates" value="6" tone="warning" />
      </div>

      <TableToolbar title="Card Templates" count={6} extraActions={["publish", "feature"]} />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Block title="Visual" items={VISUAL}/>
          <Block title="Metadata" items={META}/>
          <ButtonBlock/>
        </div>

        <aside className="glass-strong sticky top-[140px] h-fit rounded-2xl p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-accent">Live Preview</div>
          <div className="overflow-hidden rounded-2xl border border-border bg-[oklch(0.18_0.03_240)]">
            <div className="relative h-40 bg-gradient-to-br from-primary/40 via-surface to-accent/30">
              <span className="absolute left-3 top-3 rounded bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase text-success backdrop-blur">New</span>
              <span className="absolute right-3 top-3 rounded bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase text-premium backdrop-blur">Featured</span>
            </div>
            <div className="space-y-2 p-3">
              <div className="text-[13px] font-bold">Software Vala Pro</div>
              <div className="text-[11px] text-muted-foreground">Enterprise control center for marketplace ops.</div>
              <div className="flex items-center justify-between pt-1">
                <div className="font-mono text-[13px] font-bold tabular text-accent">$249</div>
                <button className="rounded-lg border border-[oklch(0.80_0.13_192/0.45)] bg-[oklch(0.80_0.13_192/0.12)] px-2.5 py-1 text-[11px] font-bold">Live Demo</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Block({ title, items }: { title: string; items: { label: string; icon: any; hint?: string }[] }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">{title}</div>
        <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const I = it.icon;
          return (
            <button key={it.label} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-2.5 py-2 text-left transition-all hover:border-[oklch(0.80_0.13_192/0.40)] hover:bg-white/[0.05]">
              <span className="flex min-w-0 items-center gap-2">
                <I className="h-3.5 w-3.5 shrink-0 text-accent"/>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold">{it.label}</span>
                  {it.hint && <span className="block text-[10px] text-muted-foreground">{it.hint}</span>}
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Edit</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ButtonBlock() {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Action Buttons</div>
        <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{BUTTONS.length}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {BUTTONS.map((b) => {
          const I = b.icon;
          return (
            <div key={b.label} className={`flex items-center justify-between rounded-lg border px-2.5 py-2 ${TONE_CLS[b.tone]}`}>
              <span className="flex items-center gap-2 text-[12px] font-bold">
                <I className="h-3.5 w-3.5"/>{b.label}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Configure</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
