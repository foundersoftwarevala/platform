import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-catalog";
import { Database, Sparkles } from "lucide-react";
import type { AiDataSource } from "@/lib/ai/types";

export function PanelHeader({ title, description, icon: Icon, source, actions }: { title: string; description: string; icon: React.ElementType; source?: AiDataSource; actions?: React.ReactNode; }) {
  const { translate: t } = useLanguage();
  return (
    <section className="hero-surface relative overflow-hidden p-5 sm:p-7">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="relative grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            VALA AI
          </span>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{t(title)}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/80 sm:text-[15px]">{t(description)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{source ? <SourceBadge source={source} /> : null}{actions}</div>
      </div>
    </section>
  );
}

export function SourceBadge({ source }: { source: AiDataSource }) {
  const live = source === "postgres";
  const { translate: t } = useLanguage();
  return (
    <Badge variant="outline" className={cn("gap-1 border-white/25 bg-white/15 text-xs font-medium text-white backdrop-blur")}>
      {live ? <Database className="size-3" /> : <Sparkles className="size-3" />}
      {live ? t("Live PostgreSQL") : t("Seed dataset")}
    </Badge>
  );
}

export function StatCard({ label, value, tone = "default", icon: Icon }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" | "info"; icon?: React.ElementType; }) {
  const { translate: t } = useLanguage();
  const toneClass = { default: "text-foreground", success: "text-success", warning: "text-warning", danger: "text-destructive", info: "text-info" }[tone];
  return (
    <div className="bento-card hover-lift p-4 sm:p-5">
      {Icon ? <span className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-border"><Icon className={`size-4 ${toneClass}`} /></span> : null}
      <p className={`text-2xl font-semibold tracking-tight sm:text-3xl ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t(label)}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  const { translate: t } = useLanguage();
  return <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t(message)}</div>;
}

export function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted/60" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />)}</div>
      <div className="h-64 animate-pulse rounded-xl bg-muted/30" />
    </div>
  );
}

export const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const formatMoney = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
