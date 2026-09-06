import { useState } from "react";
import {
  Menu, Globe2, DollarSign, Bell, MessageCircle, LogIn, UserPlus,
  Users2, Filter, Clock, Layout, Link2, Mail, Twitter, Facebook,
  Instagram, Youtube, Linkedin, Plus,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, SubNav } from "../ui";

import { notBuilt } from "@/lib/ui/not-built";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listTopBarModules, configureTopBarModule, type TopBarModule,
} from "@/lib/marketplace-manager/topbar.functions";
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

// ---------- STOREFRONT TOPBAR MANAGER ----------
export function StorefrontTopBarSection() {
  const [tab, setTab] = useState("Navigation");
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketplace", "topbar"],
    queryFn: () => listTopBarModules(),
    staleTime: 20_000,
  });

  const save = useMutation({
    mutationFn: (v: { key: string; patch: Record<string, unknown> }) =>
      configureTopBarModule({ data: v as never }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplace", "topbar"] });
      toast.success("Top bar updated");
    },
    onError: (e: Error) =>
      toast.error("That change was refused", { description: e.message }),
  });

  const modules = data?.modules ?? [];
  const rendered = modules.filter((m) => (m as { rendered?: boolean }).rendered);
  const planned = modules.filter((m) => (m as { planned?: boolean }).planned);

  const byCategory = (c: string[]) => modules.filter((m) => c.includes(m.category));

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Storefront Top Bar"
        title="Public Top Bar Manager"
        description="What customers see at the top of the marketplace storefront. Reads the same registry as Top Bar, so both screens and the header agree."
      />

      <SubNav
        items={["Navigation", "Apply Dropdown", "Language", "Currency", "Auth & Chat"]}
        active={tab}
        onChange={setTab}
      />

      {isError && (
        <Card className="mb-4">
          <div className="p-3 text-sm text-destructive">{(error as Error)?.message}</div>
        </Card>
      )}

      {/* Live preview, built from stored configuration rather than drawn. */}
      <Card className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isLoading ? "loading…" : `${rendered.filter((m) => m.status === "live").length} live on the storefront`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs">
          {isLoading && <span className="text-muted-foreground">Reading the registry…</span>}
          {!isLoading && rendered.filter((m) => m.status === "live").length === 0 && (
            <span className="text-muted-foreground">No module is live, so the header would be empty.</span>
          )}
          {rendered
            .filter((m) => m.status === "live")
            .map((m) => (
              <span key={m.module_key} className="rounded-md bg-surface px-2 py-1 text-muted-foreground">
                {m.name}
              </span>
            ))}
        </div>
        {planned.length > 0 && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {planned.length} module{planned.length === 1 ? " is" : "s are"} registered but not rendered by the
            header yet, so {planned.length === 1 ? "it does" : "they do"} not appear above.
          </div>
        )}
      </Card>

      {tab === "Navigation" && (
        <ModuleGrid modules={modules} save={save} loading={isLoading} />
      )}

      {tab === "Apply Dropdown" && (
        <>
          <SourceNote
            text="Apply roles come from the APPLY_ROLES constant in TopUtilityBar.tsx. There is no applications table, so the list is edited in that file rather than here."
          />
          <ModuleGrid modules={byCategory(["identity"])} save={save} loading={isLoading} />
        </>
      )}

      {tab === "Language" && (
        <>
          <SourceNote
            text="Languages come from src/lib/language-catalog.ts (143 entries). marketplace_translations is empty, so the picker changes the label and nothing is translated yet."
          />
          <ModuleGrid modules={byCategory(["locale"]).filter((m) => m.module_key === "language")} save={save} loading={isLoading} />
        </>
      )}

      {tab === "Currency" && (
        <>
          <SourceNote
            text="Currencies come from the CURRENCIES constant in TopUtilityBar.tsx. No currency table exists, so this controls the picker's visibility, not exchange rates."
          />
          <ModuleGrid modules={byCategory(["locale"]).filter((m) => m.module_key === "currency")} save={save} loading={isLoading} />
        </>
      )}

      {tab === "Auth & Chat" && (
        <ModuleGrid
          modules={modules.filter((m) =>
            ["login", "register", "ai-chat", "notifications"].includes(m.module_key),
          )}
          save={save}
          loading={isLoading}
        />
      )}
    </div>
  );
}

/** States plainly where a tab's data actually comes from. */
function SourceNote({ text }: { text: string }) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/10 p-3 text-[11px] text-muted-foreground">
      {text}
    </div>
  );
}

function ModuleGrid({
  modules,
  save,
  loading,
}: {
  modules: TopBarModule[];
  save: { mutate: (v: { key: string; patch: Record<string, unknown> }) => void };
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-xs text-muted-foreground">Reading the registry…</div>;
  }
  if (modules.length === 0) {
    return <div className="text-xs text-muted-foreground">No module in this group.</div>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {modules.map((m) => {
        const meta = m as TopBarModule & { rendered?: boolean; blocked_reason?: string };
        return (
          <div key={m.module_key} className="glass flex items-start justify-between gap-3 rounded-xl p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Menu className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate text-sm font-semibold">{m.name}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {meta.rendered
                  ? `${m.component} · ${m.status}`
                  : `not rendered yet — ${meta.blocked_reason ?? "no component"}`}
              </div>
            </div>
            <button
              type="button"
              disabled={!meta.rendered}
              title={meta.rendered ? "Toggle on the storefront" : "Nothing renders this module yet"}
              onClick={() =>
                save.mutate({
                  key: m.module_key,
                  patch: { status: m.status === "live" ? "hidden" : "live" },
                })
              }
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                !meta.rendered
                  ? "cursor-not-allowed border border-border text-muted-foreground opacity-60"
                  : m.status === "live"
                    ? "bg-success/15 text-success"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {meta.rendered ? (m.status === "live" ? "Live" : "Hidden") : "Planned"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FooterSection() {
  const columns = [
    ["Company", ["About", "Careers", "Blog", "Press", "Contact"]],
    ["Marketplace", ["All Products", "Categories", "Top Selling", "New Launches", "Offers"]],
    ["Partner", ["Become Reseller", "Become Vendor", "Become Author", "Affiliate", "Franchise"]],
    ["Support", ["Help Center", "Live Demo", "Documentation", "Status", "Refunds"]],
    ["Legal", ["Terms", "Privacy", "Refund Policy", "License", "GDPR"]],
  ] as const;
  const socials = [["Twitter", Twitter], ["Facebook", Facebook], ["Instagram", Instagram], ["YouTube", Youtube], ["LinkedIn", Linkedin]] as const;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Footer Manager"
        title="Storefront Footer"
        description="Columns, links, newsletter, social handles, payment & trust strip — visible on every public page."
        actions={<PillButton variant="primary">Publish Footer</PillButton>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <h3 className="mb-3 text-base font-bold">Link columns</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {columns.map(([title, links]) => (
              <div key={title} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-accent">{title}</div>
                  <button
        type="button"
        onClick={() => notBuilt("+ Link")} className="text-[11px] text-muted-foreground hover:text-foreground">+ Link</button>
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {links.map((l) => (
                    <li key={l} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2"><Link2 className="h-3 w-3" /> {l}</span>
                      <Switch on />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 text-sm font-bold">Newsletter</h3>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input placeholder="Subscribe heading…" defaultValue="Get marketplace updates" className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Show on footer</span><Switch on />
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold">Social handles</h3>
            <div className="space-y-2">
              {socials.map(([n, I]) => (
                <div key={n} className="flex items-center gap-2">
                  <I className="h-4 w-4 text-accent" />
                  <input placeholder={`@${n.toLowerCase()}`} className="flex-1 rounded border border-border bg-background/40 px-2 py-1 text-xs focus:outline-none" />
                  <Switch on />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold">Trust strip</h3>
            <EmptyHint text="Payment icons, ISO badges and SSL marks shown in footer." />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------- FILTER MANAGER ----------
export function FiltersSection() {
  const groups = [
    ["Category", ["ERP", "CRM", "HRMS", "POS", "School", "Hospital", "Hotel", "Restaurant", "Real Estate", "Inventory"]],
    ["Industry", ["Healthcare", "Education", "Retail", "Hospitality", "Manufacturing", "NGO", "Finance"]],
    ["Deployment", ["Offline", "Online", "SaaS", "Hybrid"]],
    ["Platform", ["Mobile App", "Desktop App", "Web App", "Cross Platform"]],
    ["Tags", ["AI Ready", "New", "Trending", "Best Seller", "Lifetime", "Open Source"]],
    ["Price Range", ["Free", "<$50", "$50–$249", "$249+", "Enterprise"]],
    ["Rating", ["5★", "4★+", "3★+", "Any"]],
    ["License", ["Single", "Multi", "Lifetime", "Subscription"]],
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Filter Manager"
        title="Storefront Filters"
        description="Faceted filters for category, deployment, platform, tags, price, rating & license."
        actions={<PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Filter</span></PillButton>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(([title, vals]) => (
          <Card key={title}>
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex items-center gap-2"><Filter className="h-4 w-4 text-accent" /><h3 className="text-sm font-bold">{title}</h3></div>
              <Switch on />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {vals.map((v) => (
                <span key={v} className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">{v}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- UPCOMING / WAITLIST ----------
export function UpcomingSection() {
  const upcoming = [
    "AI Voice ERP", "Hospital 360", "Realtor CRM v3", "School OS Lite",
    "Retail Edge POS", "Hotel Cloud", "Banquet Pro", "Pharmacy Plus",
  ];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Upcoming & Waitlist"
        title="Coming Soon Manager"
        description="Pre-launch products with countdowns, Notify-Me capture and waitlist tracking."
        actions={<PillButton variant="premium">+ Upcoming Product</PillButton>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {upcoming.map((p, i) => (
          <Card key={p} className="overflow-hidden">
            <div className="relative h-28 rounded-lg bg-gradient-to-br from-primary/40 via-surface to-accent/40">
              <span className="absolute left-2 top-2 rounded bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent backdrop-blur">Coming Soon</span>
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-background/60 px-2 py-0.5 text-[10px] font-bold text-premium backdrop-blur"><Clock className="h-3 w-3" /> {30 + i}d</span>
            </div>
            <div className="mt-3">
              <div className="text-sm font-bold">{p}</div>
              <div className="text-[11px] text-muted-foreground">Release: —  ·  Waitlist: —</div>
              <div className="mt-3 flex gap-1.5">
                <button
        type="button"
        onClick={() => notBuilt("Notify Me")} className="flex-1 rounded-md bg-gradient-to-r from-primary to-accent px-2 py-1.5 text-[11px] font-bold text-primary-foreground">Notify Me</button>
                <button
        type="button"
        onClick={() => notBuilt("Join Waitlist")} className="rounded-md border border-border bg-background/60 px-2 py-1.5 text-[11px]">Join Waitlist</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- NOTIFICATIONS MANAGER ----------
export function NotificationsSection() {
  const channels = [
    ["In-App Bell", "Real-time updates inside the storefront"],
    ["Email", "Order, license, demo and offer mailers"],
    ["WhatsApp", "Cart, demo and license updates"],
    ["SMS", "OTP and order alerts"],
    ["Web Push", "Browser push for offers and launches"],
    ["Telegram", "Channel broadcasts"],
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Notifications" title="Notification Channels" description="What the storefront can send and where it shows up." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {channels.map(([n, d]) => (
          <Card key={n}>
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-accent" /><span className="text-sm font-bold">{n}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{d}</p>
              </div>
              <Switch on />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- LAYOUT / WALL ORDER (DB-backed) ----------
export { LayoutOrderAdmin as LayoutOrderSection } from "./MarketplaceCatalogAdmin";
