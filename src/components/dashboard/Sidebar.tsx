import { memo } from "react";
import { Home, Compass, Layers, FolderOpen, Settings, LifeBuoy, LogOut, Sparkles, Calculator } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import logoAsset from "@/assets/dashboardLogoAsset";
import type { RoleConfig } from "@/lib/roles";
import { signOut } from "@/lib/auth-bridge";
import { notifyPending } from "@/lib/ui-actions";
import { cn } from "@/lib/utils";
import { RESELLER_CENTER_ORDER, RESELLER_CENTERS } from "@/lib/reseller-extras";

type Props = {
  role: RoleConfig;
  activeModule: string | null;
  onSelectModule: (key: string | null) => void;
};

function SidebarBase({ role, activeModule, onSelectModule }: Props) {
  const navigate = useNavigate();
  async function handleLogout() {
    await signOut();
    navigate({ to: "/", replace: true });
  }

  const isReseller = role.key === "reseller";

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-border">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="logo-3d h-11 w-11 shrink-0 block">
            <img
              src={logoAsset.url}
              alt="Software Vala"
              className="h-full w-full rounded-full object-cover"
              draggable={false}
            />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight leading-tight truncate">
              Software Vala<span className="text-[oklch(0.55_0.22_25)]">™</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">
              {role.title}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6" aria-label="Dashboard navigation">
        <Section title="Menu">
          <NavItem icon={Home} label="Dashboard" active={activeModule === null} onClick={() => onSelectModule(null)} />
          {isReseller && (
            <NavItem icon={Calculator} label="Pricing Engine" active={activeModule === "pricing"} onClick={() => onSelectModule("pricing")} accent />
          )}
          <NavItem icon={Sparkles} label="AI Chat" active={activeModule === "ai-chat"} onClick={() => onSelectModule("ai-chat")} accent />
          <NavItem icon={Compass} label="Explore" onClick={() => navigate({ to: "/" })} />
          <NavItem icon={Layers} label="Marketplace" onClick={() => navigate({ to: "/" })} />
          <NavItem
            icon={FolderOpen}
            label="Library"
            onClick={() => onSelectModule(role.modules[0]?.key ?? null)}
          />
        </Section>

        <Section title={`${role.name} Modules`}>
          {role.modules.map((m) => (
            <NavItem
              key={m.key}
              icon={m.icon}
              label={m.label}
              active={activeModule === m.key}
              onClick={() => onSelectModule(m.key)}
            />
          ))}
        </Section>

        {isReseller && (
          <Section title="Reseller Centers">
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

        <Section title="Account">
          <NavItem
            icon={Settings}
            label="Settings"
            onClick={() =>
              onSelectModule(
                role.modules.find((m) => /setting|config|profile/i.test(m.label))?.key ?? null,
              )
            }
          />
          <NavItem
            icon={LifeBuoy}
            label="Support"
            onClick={() =>
              onSelectModule(
                role.modules.find((m) => /support|ticket|help/i.test(m.label))?.key ?? "ai-chat",
              )
            }
          />
          <NavItem icon={LogOut} label="Logout" onClick={handleLogout} />
        </Section>
      </nav>

      <div className="m-3 rounded-xl bg-gradient-brand p-4 text-brand-foreground shadow-glow">
        <div className="text-xs uppercase tracking-wider opacity-80">Upgrade</div>
        <div className="mt-1 font-semibold">Go Pro</div>
        <p className="mt-1 text-xs opacity-80">Unlock advanced analytics & AI tools.</p>
        <button
          type="button"
          onClick={() => notifyPending("Upgrade to Pro", "Plan upgrades run through your existing Software Vala billing account.")}
          className="press-3d focus-ring mt-3 w-full rounded-lg bg-white/15 hover:bg-white/25 transition text-xs font-medium py-2"
        >
          Upgrade now
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `sv-nav-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function NavItem({
  icon: Icon, label, active, onClick, accent,
}: { icon: any; label: string; active?: boolean; onClick?: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group press-3d sheen-3d focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-gradient-brand text-brand-foreground shadow-glow"
          : accent
            ? "text-foreground bg-brand/10 hover:bg-brand/20 border border-brand/20"
            : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {accent && !active && <Sparkles className="ml-auto h-3 w-3 text-[oklch(0.78_0.18_290)]" aria-hidden="true" />}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
    </button>
  );
}

export const Sidebar = memo(SidebarBase) as typeof SidebarBase;
