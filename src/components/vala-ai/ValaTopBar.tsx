import { ArrowLeft, Menu } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import { useApi, type Operator, type Status } from "./api";
import { useActiveValaSection } from "./nav";

export function ValaTopBar({
  onOpenMenu,
  operator,
}: {
  onOpenMenu: () => void;
  operator: Operator;
}) {
  const { translate: t } = useLanguage();
  const section = useActiveValaSection();
  const status = useApi<Status>(["status"], "/status", { refetchInterval: 15_000 });
  const model = status.data?.model;
  const state = !model
    ? t("Checking model…")
    : model.online
      ? t("Model online")
      : t("Model offline");
  const detail = !model
    ? ""
    : model.online
      ? model.source === "ai-api-manager"
        ? `${t("AI API Manager")}: ${model.service ?? ""}${model.model ? ` · ${model.model}` : ""}`
        : `${t("Local model")}: ${model.model ?? t("online")}`
      : `${model.source === "ai-api-manager" ? t("AI API Manager not ready") : t("Local model offline")}${model.error ? ` — ${model.error}` : ""}`;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-5">
      <button
        onClick={onOpenMenu}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
        aria-label={t("Open menu")}
      >
        <Menu className="h-4 w-4" />
      </button>
      <a
        href="/control-panel"
        className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("Control Panel")}
      </a>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={t(section.label)}>
        {t(section.label)}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Always visible, one line at every width: the full model name moves into the tooltip when space is short. */}
        <span
          role="status"
          title={detail}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium",
            !model
              ? "border-border text-muted-foreground"
              : model.online
                ? "va-border-success va-text-success"
                : "va-border-danger va-text-danger",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              !model ? "bg-muted-foreground" : model.online ? "va-bg-success" : "va-bg-danger",
            )}
          />
          <span className="xl:hidden">{state}</span>
          <span className="hidden max-w-[34ch] truncate xl:inline">{detail || state}</span>
        </span>
        <span
          className="hidden max-w-[28ch] truncate whitespace-nowrap text-xs text-muted-foreground xl:inline"
          title={`${operator.email} · ${t(operator.role)}`}
        >
          {operator.email} · {t(operator.role)}
        </span>
      </div>
    </header>
  );
}

export default ValaTopBar;
