import { memo } from "react";
import {
  Home,
  Compass,
  Layers,
  FolderOpen,
  Settings,
  LifeBuoy,
  LogOut,
  Sparkles,
  Calculator,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import logoAsset from "@/assets/dashboardLogoAsset";
import type { RoleConfig } from "@/lib/roles";
import { signOut } from "@/lib/auth-bridge";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { RESELLER_CENTER_ORDER, RESELLER_CENTERS } from "@/lib/reseller-extras";
import { useTranslation } from "@/lib/i18n/use-translation";

type Props = {
  role: RoleConfig;
  activeModule: string | null;
  onSelectModule: (key: string | null) => void;
};

function SidebarBase({ role, activeModule, onSelectModule }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  async function handleLogout() {
    // Cached records belong to the signed-out user; clear them even if
    // signing out fails, so the next person on this tab never sees them.
    try {
      await signOut();
    } finally {
      queryClient.clear();
      navigate({ to: "/", replace: true });
    }
  }

  const isReseller = role.key === "reseller";
  // The role's own settings screen, if it has one (developer, dev-manager and
  // promise-tracker do; a reseller's is the Settings Center). Every other role
  // has none, so its Settings item is shown disabled with the reason rather
  // than silently landing back on the dashboard home.
  const settingsTarget = isReseller
    ? "center:settings"
    : (role.modules.find((m) => /setting|config|profile/i.test(m.label))?.key ?? null);
  // The role's ticket desk: a tickets/help-desk module (admin's Tickets), else
  // its AMS (Support Requests) workspace, which every role - reseller
  // included - has. A bare "support" label is not matched: on the promise
  // tracker "Support" is a promise category, not a desk.
  const supportTarget =
    role.modules.find((m) => /ticket|help/i.test(m.label))?.key ??
    role.modules.find((m) => m.key === "ams")?.key ??
    null;

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-border">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="logo-3d h-11 w-11 shrink-0 block">
            <img
              src={logoAsset.url}
              alt={"Software Vala" /* i18n-ignore: brand name */}
              className="h-full w-full rounded-full object-cover"
              draggable={false}
            />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight leading-tight truncate">
              {/* i18n-ignore: brand name */}
              Software Vala<span className="text-[oklch(0.55_0.22_25)]">™</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">
              {role.titleKey ? t(role.titleKey) : role.title}
            </div>
          </div>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6"
        aria-label={t("dashboard.sidebar.navigation")}
      >
        <Section id="menu" title={t("dashboard.sidebar.menu")}>
          <NavItem
            icon={Home}
            label={t("dashboard.sidebar.dashboard")}
            active={activeModule === null}
            onClick={() => onSelectModule(null)}
          />
          {isReseller && (
            <NavItem
              icon={Calculator}
              label={t("dashboard.sidebar.pricing_engine")}
              active={activeModule === "pricing"}
              onClick={() => onSelectModule("pricing")}
              accent
            />
          )}
          <NavItem
            icon={Sparkles}
            label={t("dashboard.sidebar.ai_chat")}
            active={activeModule === "ai-chat"}
            onClick={() => onSelectModule("ai-chat")}
            accent
          />
          <NavItem
            icon={Compass}
            label={t("dashboard.sidebar.explore")}
            onClick={() => navigate({ to: "/" })}
          />
          {/* Explore is the home page; Marketplace is the catalogue itself. */}
          <NavItem
            icon={Layers}
            label={t("dashboard.sidebar.marketplace")}
            onClick={() => navigate({ to: "/marketplace" })}
          />
          <NavItem
            icon={FolderOpen}
            label={t("dashboard.sidebar.library")}
            onClick={() => onSelectModule(role.modules[0]?.key ?? null)}
          />
        </Section>

        <Section
          id={`${role.name} Modules`}
          title={t("dashboard.sidebar.role_modules", {
            role: role.nameKey ? t(role.nameKey) : role.name,
          })}
        >
          {role.modules.map((m) => (
            <NavItem
              key={m.key}
              icon={m.icon}
              label={m.labelKey ? t(m.labelKey) : m.label}
              active={activeModule === m.key}
              onClick={() => onSelectModule(m.key)}
            />
          ))}
        </Section>

        {isReseller && (
          <Section id="Reseller Centers" title={t("dashboard.sidebar.reseller_centers")}>
            {RESELLER_CENTER_ORDER.map((k) => {
              const c = RESELLER_CENTERS[k];
              const key = `center:${k}`;
              return (
                <NavItem
                  key={k}
                  icon={c.icon}
                  label={c.label}
                  active={activeModule === key}
                  onClick={() => onSelectModule(key)}
                />
              );
            })}
          </Section>
        )}

        <Section id="Account" title={t("dashboard.sidebar.account")}>
          <NavItem
            icon={Settings}
            label={t("dashboard.sidebar.settings")}
            active={!!settingsTarget && activeModule === settingsTarget}
            disabledReason={settingsTarget ? undefined : t("dashboard.sidebar.no_settings")}
            onClick={() => settingsTarget && onSelectModule(settingsTarget)}
          />
          <NavItem
            icon={LifeBuoy}
            label={t("dashboard.sidebar.support")}
            active={!!supportTarget && activeModule === supportTarget}
            // The role's own ticket desk (AMS - Support Requests); the AI chat
            // only for a role with no desk at all.
            onClick={() => onSelectModule(supportTarget ?? "ai-chat")}
          />
          <NavItem icon={LogOut} label={t("dashboard.sidebar.logout")} onClick={handleLogout} />
        </Section>
      </nav>

      <div className="m-3 rounded-xl bg-gradient-brand p-4 text-brand-foreground shadow-glow">
        <div className="text-xs uppercase tracking-wider opacity-80">
          {t("dashboard.sidebar.upgrade")}
        </div>
        <div className="mt-1 font-semibold">{t("dashboard.sidebar.go_pro")}</div>
        <p className="mt-1 text-xs opacity-80">{t("dashboard.sidebar.upgrade_pitch")}</p>
        <button
          type="button"
          // A reseller upgrades by buying a membership plan, which is a real
          // screen of their own. No other role has a plan or billing screen on
          // the platform, so for them the button is disabled and says why
          // instead of showing a notice that promised a billing account.
          disabled={!isReseller}
          title={isReseller ? undefined : t("dashboard.sidebar.no_plan")}
          aria-label={
            isReseller
              ? undefined
              : `${t("dashboard.sidebar.upgrade_now")} - ${t("dashboard.sidebar.no_plan")}`
          }
          onClick={() => isReseller && onSelectModule("membership")}
          className="press-3d focus-ring mt-3 w-full rounded-lg bg-white/15 hover:bg-white/25 transition text-xs font-medium py-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white/15"
        >
          {t("dashboard.sidebar.upgrade_now")}
        </button>
      </div>
    </aside>
  );
}

/**
 * `id` is the section's English heading: the element id is made from it, so it
 * stays the same in every language while the heading itself is translated.
 */
function Section({
  id: name,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const id = `sv-nav-${name.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
      >
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  accent,
  disabledReason,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
  accent?: boolean;
  /** When set, the item has nothing behind it: disabled, with this as the reason. */
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabledReason}
      title={disabledReason}
      aria-label={disabledReason ? `${label} - ${disabledReason}` : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group press-3d sheen-3d focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        active
          ? "bg-gradient-brand text-brand-foreground shadow-glow"
          : accent
            ? "text-foreground bg-brand/10 hover:bg-brand/20 border border-brand/20"
            : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {accent && !active && (
        <Sparkles className="ml-auto h-3 w-3 text-[oklch(0.78_0.18_290)]" aria-hidden="true" />
      )}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
    </button>
  );
}

export const Sidebar = memo(SidebarBase) as typeof SidebarBase;
