import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Bell, Bug, Cpu, FileText, Menu, MoreHorizontal, Plus, RotateCcw, Search, Settings, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ICON_BTN = "icon3d relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-[transform,box-shadow,color,background-color] duration-200 hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const ACTIONS: { label: string; icon: LucideIcon; to: string }[] = [
  { label: "Execution Logs", icon: FileText, to: "/vala-ai/logs" },
  { label: "Error Detection", icon: Bug, to: "/vala-ai/errors" },
  { label: "Rollback", icon: RotateCcw, to: "/vala-ai/rollback" },
  { label: "AI Models", icon: Cpu, to: "/vala-ai/models" },
  { label: "Credits", icon: Wallet, to: "/vala-ai/credits" },
];

function IconAction({ icon: Icon, label, to, className }: { icon: LucideIcon; label: string; to: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={to} aria-label={label} className={cn(ICON_BTN, className)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ValaTopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { translate: t } = useLanguage();

  return (
    <TooltipProvider delayDuration={120}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-1.5 px-3 lg:px-5">
          <button className={cn(ICON_BTN, "lg:hidden")} onClick={onOpenMenu} aria-label={t("Open menu")}>
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <Link to="/" className="mr-1 flex shrink-0 items-center gap-2 lg:hidden" aria-label={t("Home")}>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-[11px] font-bold text-primary-foreground">SV</span>
          </Link>

          <div className="flex-1" />

          <nav className="flex items-center gap-1" aria-label={t("Global actions")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/vala-ai/prompts" aria-label={t("Search prompts")} className={ICON_BTN}>
                  <Search className="h-[18px] w-[18px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("Search prompts")}</TooltipContent>
            </Tooltip>

            <IconAction icon={Bell} label={t("Error Detection")} to="/errors" />
            {ACTIONS.map((a) => (
              <IconAction key={a.label} icon={a.icon} label={t(a.label)} to={a.to} className="hidden xl:grid" />
            ))}

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(ICON_BTN, "xl:hidden")} aria-label={t("More actions")}>
                      <MoreHorizontal className="h-[18px] w-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("More actions")}</TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end" loop className="w-56">
                <DropdownMenuLabel>{t("More")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ACTIONS.map((a) => (
                  <DropdownMenuItem key={a.label} asChild>
                    <Link to={a.to} className="cursor-pointer">
                      <a.icon className="mr-2 h-4 w-4" />
                      {t(a.label)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <IconAction icon={Settings} label={t("Settings")} to="/vala-ai/settings" className="hidden xl:grid" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/vala-ai/" aria-label={t("New command")} className={cn(ICON_BTN, "icon3d--accent text-primary-foreground")}>
                  <Plus className="h-[18px] w-[18px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("New command")}</TooltipContent>
            </Tooltip>

            <span className="ml-0.5 relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-[11px] font-bold text-primary-foreground ring-1 ring-white/15">
              BV
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent-emerald ring-2 ring-background" />
            </span>
          </nav>
        </div>
      </header>
    </TooltipProvider>
  );
}

export default ValaTopBar;
