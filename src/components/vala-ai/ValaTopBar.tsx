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

  return (
    <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-5">
      <button
        onClick={onOpenMenu}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
        aria-label={t("Open menu")}
      >
        <Menu className="h-4 w-4" />
      </button>
      <a
        href="/control-panel"
        className="hidden items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("Control Panel")}
      </a>
      <p className="min-w-0 truncate text-sm font-semibold">{t(section.label)}</p>
      <div className="ml-auto flex items-center gap-2">
        <span
          title={model?.error ?? model?.url ?? ""}
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
            !model
              ? "border-border text-muted-foreground"
              : model.online
                ? "border-success/40 text-success"
                : "border-destructive/40 text-destructive",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              !model ? "bg-muted-foreground" : model.online ? "bg-success" : "bg-destructive",
            )}
          />
          {!model
            ? t("Checking model…")
            : model.online
              ? `${t("Local model")}: ${model.model ?? t("online")}`
              : t("Local model offline")}
        </span>
        <span className="hidden text-xs text-muted-foreground md:inline">
          {operator.email} · {t(operator.role)}
        </span>
      </div>
    </div>
  );
}

export default ValaTopBar;
