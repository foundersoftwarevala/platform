import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import "@/styles/dashboard.css";
import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { Hero } from "@/components/dashboard/Hero";
import { VendorSliderHero } from "@/components/dashboard/VendorSliderHero";
import { ResellerHero } from "@/components/dashboard/ResellerHero";
import { AuthorHero } from "@/components/dashboard/AuthorHero";
import { ResellerProfileHero } from "@/components/dashboard/ResellerProfileHero";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { ContentRows } from "@/components/dashboard/ContentRows";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { KpiToolbar, type KpiSort, type KpiTone } from "@/components/dashboard/KpiToolbar";
import { ModuleBoundary } from "@/components/dashboard/ModuleBoundary";
import { ModuleFocusScope } from "@/components/dashboard/ModuleFocusScope";
import { ROLES, isRoleKey, type RoleKey } from "@/lib/roles";
import { usePermissions } from "@/hooks/use-permissions";
import { ModuleFallback, AccessDenied } from "@/components/dashboard/AccessStates";

const AIChatWorkspace = lazy(() => import("@/components/dashboard/AIChatWorkspace").then((m) => ({ default: m.AIChatWorkspace })));
const AISuitePage = lazy(() => import("@/components/dashboard/AISuitePage").then((m) => ({ default: m.AISuitePage })));
const ResellerAISuitePage = lazy(() => import("@/components/dashboard/ResellerAISuitePage").then((m) => ({ default: m.ResellerAISuitePage })));
const ResellerPricingWorkspace = lazy(() => import("@/components/dashboard/ResellerPricingWorkspace").then((m) => ({ default: m.ResellerPricingWorkspace })));
const ResellerCenterPage = lazy(() => import("@/components/dashboard/ResellerCenterPage").then((m) => ({ default: m.ResellerCenterPage })));
const ModulePage = lazy(() => import("@/components/dashboard/ModulePage").then((m) => ({ default: m.ModulePage })));
const ResellerModulePage = lazy(() => import("@/components/dashboard/ResellerModulePage").then((m) => ({ default: m.ResellerModulePage })));
const FranchiseHome = lazy(() => import("@/components/dashboard/franchise/FranchiseHome").then((m) => ({ default: m.FranchiseHome })));
const FranchiseModulePage = lazy(() => import("@/components/dashboard/franchise/FranchiseModules").then((m) => ({ default: m.FranchiseModulePage })));
const FRANCHISE_MODULE_KEYS = ["branches", "leads", "revenue", "employees"];
const isFranchiseModule = (k: string) => FRANCHISE_MODULE_KEYS.includes(k);


const ROLE_BANNER_GRADIENTS: Record<RoleKey, string> = {
  reseller:   "linear-gradient(120deg, oklch(0.26 0.06 175), oklch(0.32 0.16 160), oklch(0.42 0.22 150))",
  author:     "linear-gradient(120deg, oklch(0.24 0.08 275), oklch(0.32 0.16 265), oklch(0.42 0.20 255))",
  vendor:     "linear-gradient(120deg, oklch(0.24 0.06 210), oklch(0.32 0.14 200), oklch(0.42 0.18 195))",
  affiliate:  "linear-gradient(120deg, oklch(0.24 0.08 310), oklch(0.32 0.16 300), oklch(0.42 0.20 295))",
  influencer: "linear-gradient(120deg, oklch(0.26 0.08 350), oklch(0.34 0.18 350), oklch(0.44 0.20 20))",
  franchise:  "linear-gradient(120deg, oklch(0.26 0.06 60),  oklch(0.34 0.14 65),  oklch(0.44 0.18 55))",
  seo:        "linear-gradient(120deg, oklch(0.24 0.06 215), oklch(0.32 0.14 210), oklch(0.42 0.18 205))",
  admin:      "linear-gradient(120deg, oklch(0.22 0.03 250), oklch(0.30 0.06 245), oklch(0.40 0.08 245))",
  developer:        "linear-gradient(120deg, oklch(0.24 0.05 260), oklch(0.32 0.14 250), oklch(0.42 0.18 235))",
  "dev-manager":    "linear-gradient(120deg, oklch(0.24 0.06 220), oklch(0.32 0.14 210), oklch(0.42 0.18 195))",
  "promise-tracker":"linear-gradient(120deg, oklch(0.26 0.06 325), oklch(0.34 0.16 335), oklch(0.44 0.20 350))",
};
import { RESELLER_CENTER_ORDER, type CenterKey } from "@/lib/reseller-extras";

const dashboardSearchSchema = z.object({
  kpiTone: fallback(z.string(), "all").default("all"),
  kpiSort: fallback(z.string(), "default").default("default"),
});

export const Route = createFileRoute("/dashboard/$role")({
  beforeLoad: ({ params }) => {
    if (!isRoleKey(params.role)) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: zodValidator(dashboardSearchSchema),
  head: ({ params }) => {
    const cfg = isRoleKey(params.role) ? ROLES[params.role] : null;
    return {
      meta: [
        { title: cfg ? `${cfg.title} — Software Vala` : "Dashboard — Software Vala" },
        { name: "description", content: cfg ? `${cfg.title}. ${cfg.tagline}.` : "Software Vala workspace." },
      ],
    };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { role } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const cfg = ROLES[role as RoleKey];
  const perms = usePermissions(role as RoleKey);
  const openModule = useCallback(
    (key: string | null) => setActiveModule(key && perms.canOpen(key) ? key : null),
    [perms],
  );
  const closeModule = useCallback(() => setActiveModule(null), []);
  const kpiTone = search.kpiTone as KpiTone;
  const kpiSort = search.kpiSort as KpiSort;
  const setKpiTone = (t: KpiTone) =>
    navigate({
      to: "/dashboard/$role",
      params: { role },
      search: (prev: Record<string, unknown>) => ({ ...prev, kpiTone: t }),
      replace: true,
    });
  const setKpiSort = (s: KpiSort) =>
    navigate({
      to: "/dashboard/$role",
      params: { role },
      search: (prev: Record<string, unknown>) => ({ ...prev, kpiSort: s }),
      replace: true,
    });

  const switchRoleUnchecked = useCallback(
    (next: RoleKey) => {
      setActiveModule(null);
      navigate({ to: "/dashboard/$role", params: { role: next } });
    },
    [navigate],
  );
  const switchRole = useCallback(
    (next: RoleKey) => {
      if (!perms.accessibleRoles.includes(next)) return;
      closeModule();
      navigate({ to: "/dashboard/$role", params: { role: next } });
    },
    [navigate, perms.accessibleRoles],
  );

  const isAIChat = activeModule === "ai-chat";
  const isPricing = activeModule === "pricing" && role === "reseller";
  const centerMatch = activeModule?.startsWith("center:")
    ? (activeModule.slice("center:".length) as CenterKey)
    : null;
  const isCenter =
    centerMatch && (RESELLER_CENTER_ORDER as readonly string[]).includes(centerMatch);

  const availableTones = useMemo<KpiTone[]>(() => {
    const set = new Set<KpiTone>(cfg.kpis.map((k) => k.tone));
    return ["all", ...Array.from(set)];
  }, [cfg.kpis]);

  const filteredKpis = useMemo(() => {
    let list = kpiTone === "all" ? cfg.kpis : cfg.kpis.filter((k) => k.tone === kpiTone);
    switch (kpiSort) {
      case "label_asc":  list = [...list].sort((a, b) => a.label.localeCompare(b.label)); break;
      case "label_desc": list = [...list].sort((a, b) => b.label.localeCompare(a.label)); break;
      case "tone":       list = [...list].sort((a, b) => a.tone.localeCompare(b.tone)); break;
      default: break;
    }
    return list;
  }, [cfg.kpis, kpiTone, kpiSort]);

  const activeLabel = (() => {
    if (isAIChat) return "AI Chat";
    if (isPricing) return "Pricing Engine";
    if (isCenter) return `${centerMatch} Center`;
    if (activeModule) return cfg.modules.find((m) => m.key === activeModule)?.label ?? activeModule;
    return null;
  })();

  const crumbs = activeLabel
    ? [{ label: "Home", onClick: closeModule }, { label: cfg.name, onClick: closeModule }, { label: activeLabel }]
    : [{ label: "Home" }, { label: cfg.name }];

  return (
    <div className="dm-theme min-h-dvh flex bg-background text-foreground">
      <Sidebar role={cfg} activeModule={activeModule} onSelectModule={openModule} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar role={cfg} onSwitchRole={switchRole} onOpenAIChat={() => openModule("ai-chat")} onOpenModule={openModule} allowedRoles={perms.accessibleRoles} />
        <main className="flex-1 px-4 md:px-6 py-5 space-y-5 overflow-x-hidden">
          <Breadcrumbs items={crumbs} />
          {!perms.allowedHere ? (
            <AccessDenied
              roleName={cfg.name}
              sessionRole={perms.sessionRole}
              onGoHome={() => perms.sessionRole && switchRoleUnchecked(perms.sessionRole)}
            />
          ) : isAIChat ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}><AIChatWorkspace onBack={closeModule} /></Suspense></ModuleBoundary></ModuleFocusScope>
          ) : isPricing ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}><ResellerPricingWorkspace onBack={closeModule} /></Suspense></ModuleBoundary></ModuleFocusScope>
          ) : isCenter && role === "reseller" ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}><ResellerCenterPage centerKey={centerMatch as CenterKey} onBack={closeModule} /></Suspense></ModuleBoundary></ModuleFocusScope>
          ) : activeModule && role === "franchise" && isFranchiseModule(activeModule) ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}><FranchiseModulePage moduleKey={activeModule} onBack={closeModule} /></Suspense></ModuleBoundary></ModuleFocusScope>
          ) : activeModule === "ai" && role === "vendor" ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}><AISuitePage onBack={closeModule} /></Suspense></ModuleBoundary></ModuleFocusScope>
          ) : activeModule === "ai" && role === "reseller" ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}><ResellerAISuitePage onBack={closeModule} /></Suspense></ModuleBoundary></ModuleFocusScope>
          ) : activeModule ? (
            <ModuleFocusScope label={activeLabel ?? "Module"} onEscape={closeModule}><ModuleBoundary onReset={closeModule}><Suspense fallback={<ModuleFallback />}>
              {role === "reseller"
                ? <ResellerModulePage role={cfg} moduleKey={activeModule} onBack={closeModule} />
                : <ModulePage role={cfg} moduleKey={activeModule} onBack={closeModule} />}
            </Suspense></ModuleBoundary></ModuleFocusScope>
          ) : (
            <>
              <ResellerProfileHero
                roleName={cfg.name}
                accountLabel={`Your ${cfg.name} Account`}
                centerLabel={`${cfg.name} Center`}
                bannerGradient={ROLE_BANNER_GRADIENTS[role as RoleKey]}
              />
              {role === "reseller" ? (
                <ResellerHero />
              ) : role === "vendor" ? (
                <VendorSliderHero role={cfg} onCta={() => openModule(cfg.modules[0]?.key ?? null)} />
              ) : role === "author" ? (
                <AuthorHero role={cfg} onCta={() => openModule(cfg.modules[0]?.key ?? null)} />
              ) : (
                <Hero role={cfg} onCta={() => openModule(cfg.modules[0]?.key ?? null)} onAnalytics={() => openModule(cfg.modules.find(m => /analytic|report|insight/i.test(m.label))?.key ?? cfg.modules[0]?.key ?? null)} />
              )}
              <KpiToolbar
                tones={availableTones}
                tone={kpiTone}
                onToneChange={setKpiTone}
                sort={kpiSort}
                onSortChange={setKpiSort}
              />
              <KpiGrid items={filteredKpis} roleKey={role} onOpen={openModule} />
              {role === "franchise" ? (
                <Suspense fallback={<ModuleFallback />}><FranchiseHome onOpen={openModule} /></Suspense>
              ) : (
                <ContentRows role={cfg} onOpen={openModule} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
