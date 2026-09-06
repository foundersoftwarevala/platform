import { useMemo, useState } from "react";
import {
  Globe2, DollarSign, Sparkles, LogIn, UserCircle, Bell, Heart, CalendarDays,
  Calculator, LayoutGrid, UserPlus, GripVertical, Eye, EyeOff, ChevronUp,
  ChevronDown, Smartphone, Tablet, Monitor, PinIcon, AlertTriangle, Star,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader, PillButton, StatCard, Card, EmptyHint } from "../ui";
import {
  listTopBarModules, configureTopBarModule, reorderTopBarModules,
  type TopBarModule,
} from "@/lib/marketplace-manager/topbar.functions";

/**
 * Storefront Top Bar Manager — the modules the header actually renders.
 *
 * This screen used to list twenty-five modules from a static array under the
 * hardcoded label "Top Bar Manager · 25 modules". Reading TopUtilityBar.tsx
 * settles the real number: it composes ten — ApplyNow, LanguagePicker,
 * CalendarTool, CalculatorTool, LoginPill, CurrencyPicker, Notifications,
 * Favorites, AiChat and DashboardsMenu.
 *
 * Nineteen of the old twenty-five described things the header does not have —
 * Logo, Marketplace Name, Navigation, Mega Menu, Products/Categories/Solutions/
 * Pricing menus, Search, Register, Announcement Bar, Header Banner, Top
 * Promotion, Sticky Header and the three device headers. Four real modules were
 * missing from it entirely: Calendar, Calculator, Favorites and Dashboards.
 *
 * Everything below comes from marketplace_topbar_modules, which TopUtilityBar
 * itself now reads, so hiding or reordering here changes the storefront.
 */

const KEY = ["marketplace", "topbar"] as const;

const ICONS: Record<string, typeof Globe2> = {
  "apply-now": UserPlus, language: Globe2, calendar: CalendarDays,
  calculator: Calculator, login: LogIn, currency: DollarSign,
  notifications: Bell, favorites: Heart, "ai-chat": Sparkles,
  dashboards: LayoutGrid,
};

const STATUS_TONE: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  draft: "text-warning border-warning/40 bg-warning/10",
  hidden: "text-muted-foreground border-border bg-white/[0.04]",
  archived: "text-muted-foreground border-border bg-white/[0.04]",
};

export function TopBarManagerSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("All");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: KEY,
    queryFn: () => listTopBarModules(),
    staleTime: 20_000,
  });

  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: KEY });
    toast.success(msg);
  };
  const fail = (e: Error) =>
    toast.error("That change was refused", { description: e.message });

  const configure = useMutation({
    mutationFn: (v: { key: string; patch: Record<string, unknown> }) =>
      configureTopBarModule({ data: v as never }),
    onSuccess: (r) => done(String(r.message ?? "Updated")), onError: fail,
  });
  const reorder = useMutation({
    mutationFn: (keys: string[]) => reorderTopBarModules({ data: { keys } }),
    onSuccess: () => done("Top bar reordered"), onError: fail,
  });

  const modules = useMemo(() => data?.modules ?? [], [data]);
  const groups = useMemo(
    () => ["All", ...Array.from(new Set(modules.map((m) => m.category)))],
    [modules],
  );
  const list = tab === "All" ? modules : modules.filter((m) => m.category === tab);

  // Counted, never declared.
  const live = modules.filter((m) => m.status === "live").length;
  const draft = modules.filter((m) => m.status === "draft").length;
  const hidden = modules.filter((m) => m.status === "hidden").length;

  const nudge = (key: string, dir: -1 | 1) => {
    const all = [...modules];
    const i = all.findIndex((m) => m.module_key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    reorder.mutate(all.map((m) => m.module_key));
  };

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={
          isLoading
            ? "Storefront top bar"
            : `Storefront top bar · ${modules.length} module${modules.length === 1 ? "" : "s"}`
        }
        title="Storefront Top Bar Manager"
        description="The modules TopUtilityBar renders on the marketplace homepage. Hiding or reordering here changes the storefront."
      />

      {isError && (
        <Card>
          <div className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <div className="font-medium text-destructive">Could not load the top bar modules</div>
              <div className="text-muted-foreground">{(error as Error)?.message}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Modules" value={isLoading ? "—" : String(modules.length)} />
        <StatCard label="Live" value={isLoading ? "—" : String(live)} tone="success" />
        <StatCard label="Draft" value={isLoading ? "—" : String(draft)} tone="warning" />
        <StatCard label="Hidden" value={isLoading ? "—" : String(hidden)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setTab(g)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === g ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {isLoading && <EmptyHint text="Reading the top bar registry…" />}
      {!isLoading && list.length === 0 && (
        <EmptyHint text={`No module in “${tab}”.`} />
      )}

      <div className="space-y-2">
        {list.map((m: TopBarModule, i) => {
          const Icon = ICONS[m.module_key] ?? LayoutGrid;
          const note = String(m.config?.note ?? "");
          return (
            <Card key={m.module_key}>
              <div className="flex flex-wrap items-center gap-3 p-3">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <button
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => nudge(m.module_key, -1)}
                    disabled={tab !== "All" || i === 0 || reorder.isPending}
                    aria-label={`Move ${m.name} up`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => nudge(m.module_key, 1)}
                    disabled={tab !== "All" || i === list.length - 1 || reorder.isPending}
                    aria-label={`Move ${m.name} down`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Icon className="h-4 w-4 shrink-0 text-accent" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    <code className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {m.module_key}
                    </code>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATUS_TONE[m.status]}`}>
                      {m.status}
                    </span>
                    {m.featured && (
                      <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {m.component ? `${m.component} · ` : ""}{m.description}
                    {note ? ` · ${note}` : ""}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { status: m.status === "live" ? "hidden" : "live" },
                      })
                    }
                  >
                    {m.status === "live" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {m.status === "live" ? "Visible" : "Hidden"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { desktop_enabled: !m.desktop_enabled },
                      })
                    }
                  >
                    <Monitor className="h-3.5 w-3.5" /> {m.desktop_enabled ? "on" : "off"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { tablet_enabled: !m.tablet_enabled },
                      })
                    }
                  >
                    <Tablet className="h-3.5 w-3.5" /> {m.tablet_enabled ? "on" : "off"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { mobile_enabled: !m.mobile_enabled },
                      })
                    }
                  >
                    <Smartphone className="h-3.5 w-3.5" /> {m.mobile_enabled ? "on" : "off"}
                  </PillButton>
                  <PillButton
                    onClick={() =>
                      configure.mutate({
                        key: m.module_key,
                        patch: { featured: !m.featured },
                      })
                    }
                  >
                    <PinIcon className="h-3.5 w-3.5" /> {m.featured ? "Featured" : "Feature"}
                  </PillButton>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {tab !== "All" && list.length > 1 && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          Reordering is available on the All tab, because order is a property of the whole bar.
        </div>
      )}
    </div>
  );
}

export default TopBarManagerSection;
