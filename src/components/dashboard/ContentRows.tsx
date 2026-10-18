import { memo } from "react";
import { Inbox, Plus } from "lucide-react";
import type { RoleConfig } from "@/lib/roles";
import { useTranslation } from "@/lib/i18n/use-translation";

function ContentRowsBase({ role, onOpen }: { role: RoleConfig; onOpen?: (k: string) => void }) {
  const { t } = useTranslation();
  const label = (m: RoleConfig["modules"][number]) => (m.labelKey ? t(m.labelKey) : m.label);
  const firstModule = role.modules[0];
  const firstLabel = firstModule ? label(firstModule) : undefined;
  const open = (k?: string) => {
    if (k && onOpen) onOpen(k);
  };
  const settingsModule =
    role.modules.find((m) => /setting|profile|account/i.test(m.label)) ?? firstModule;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-4">
        <Card
          title={
            firstLabel
              ? t("dashboard.rows.recent", { module: firstLabel })
              : t("dashboard.rows.recent_activity")
          }
          action={t("dashboard.rows.see_all")}
          onAction={() => open(firstModule?.key)}
        >
          <EmptyBlock
            // This card reads no records, so it cannot say there are none ("No
            // products yet" was shown to sellers with live products): it points
            // to the module that holds them.
            label={
              firstLabel
                ? t("dashboard.rows.open_to_view", { module: firstLabel })
                : t("dashboard.rows.no_items_yet")
            }
            sub={t("dashboard.rows.items_note")}
            cta={
              firstLabel
                ? t("dashboard.rows.create", {
                    item: firstModule?.labelKey ? firstLabel : firstLabel.replace(/s$/, ""),
                  })
                : t("dashboard.rows.create_item")
            }
            onCta={() => open(firstModule?.key)}
          />
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card
            title={t("dashboard.rows.quick_actions")}
            action={t("dashboard.rows.customize")}
            onAction={() => open(settingsModule?.key)}
          >
            <div className="grid grid-cols-2 gap-2">
              {role.modules.slice(0, 4).map((m) => (
                <button
                  key={m.key}
                  onClick={() => open(m.key)}
                  className="group flex items-center gap-3 rounded-xl bg-surface border border-border p-3 text-left depth-3d sheen-3d hover:border-brand/50 hover:bg-surface-2"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-[oklch(0.78_0.18_265)] emboss-3d transition-transform duration-300 group-hover:scale-110">
                    <m.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{label(m)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("dashboard.rows.open_module")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title={t("dashboard.rows.activity_feed")}
            action={t("dashboard.rows.mark_all_read")}
            // Nothing feeds this card yet, so there is nothing to mark read:
            // the action is disabled and says why (it used to toast).
            onAction={() => {}}
            actionDisabledReason={`${t("dashboard.rows.feed_not_connected")}. ${t("dashboard.rows.feed_bell")}`}
          >
            <div className="py-6 grid place-items-center text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-muted-foreground">
                <Inbox className="h-4 w-4" />
              </div>
              {/* "All caught up" was a claim this card cannot make - it reads nothing. */}
              <div className="mt-3 text-sm font-semibold">
                {t("dashboard.rows.feed_not_connected")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("dashboard.rows.events_note")}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Right column: role-specific spotlight */}
      <aside className="rounded-2xl border border-border bg-card p-5 depth-3d flex flex-col">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("dashboard.rows.workspace")}
        </div>
        <div className="mt-2 text-lg font-bold">
          {role.titleKey ? t(role.titleKey) : role.title}
        </div>
        <div className="text-xs text-muted-foreground">
          {role.taglineKey ? t(role.taglineKey) : role.tagline}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface/40 p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("dashboard.rows.benchmark")}
          </div>
          <div className="mt-1 text-sm font-semibold">{role.benchmarks.join(" + ")}</div>
          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            {t("dashboard.rows.modeled_after", {
              role: (role.nameKey ? t(role.nameKey) : role.name).toLowerCase(),
            })}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {role.modules.slice(0, 3).map((m) => (
            <button
              key={m.key}
              onClick={() => open(m.key)}
              className="w-full text-left flex items-center gap-3 rounded-lg bg-surface/60 border border-border p-2.5 press-3d hover:bg-surface-2 hover:border-brand/40"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-[oklch(0.78_0.18_265)] shadow-[inset_0_1px_0_0_oklch(1_0_0/0.12)]">
                <m.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">{label(m)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t("dashboard.rows.open_to_view_short")}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{t("dashboard.rows.open")}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Card({
  title,
  action,
  onAction,
  actionDisabledReason,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  /** When set, the action has nothing behind it: disabled, with this reason. */
  actionDisabledReason?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card border border-border p-4 md:p-5 depth-3d">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={!!actionDisabledReason}
            title={actionDisabledReason}
            aria-label={actionDisabledReason ? `${action} - ${actionDisabledReason}` : undefined}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyBlock({
  label,
  sub,
  cta,
  onCta,
}: {
  label: string;
  sub: string;
  cta: string;
  onCta?: () => void;
}) {
  return (
    <div className="grid place-items-center text-center rounded-xl bg-surface/40 border border-dashed border-border p-8">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">{sub}</div>
      <button
        onClick={onCta}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold press-3d hover:opacity-95"
      >
        <Plus className="h-3.5 w-3.5" /> {cta}
      </button>
    </div>
  );
}

export const ContentRows = memo(ContentRowsBase) as typeof ContentRowsBase;
