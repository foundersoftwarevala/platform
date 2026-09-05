import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/affiliate/StatusBadge";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import {
  BadgeCheck, Banknote, Download, Layers, Megaphone, Plus, Ticket, Upload, UserPlus, Wallet, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { usePermissions, can, QUICK_ACTION_PERMISSIONS, type Permission } from "@/lib/affiliate-permissions";
import { toast } from "sonner";

type Item = { label: string; icon: LucideIcon; desc: string; to?: string };

const create: Item[] = [
  { label: "Add Affiliate", icon: UserPlus, desc: "Manually create an affiliate", to: "/affiliate-manager/affiliates" },
  { label: "Launch Campaign", icon: Megaphone, desc: "New campaign with products & budget", to: "/affiliate-manager/campaigns" },
  { label: "Generate Codes", icon: Ticket, desc: "Bulk create referral / coupon codes", to: "/affiliate-manager/referral-codes" },
  { label: "Issue Payout", icon: Wallet, desc: "One-off or batch payout", to: "/affiliate-manager/payouts" },
  { label: "Adjust Commission", icon: Banknote, desc: "Manual credit or debit", to: "/affiliate-manager/commissions" },
  { label: "Create Workflow", icon: Workflow, desc: "Automation rule", to: "/affiliate-manager/settings" },
];

const ops: Item[] = [
  { label: "Mass Bulk Actions", icon: Layers, desc: "Approve, suspend, message, assign, payout", to: "/affiliate-manager/bulk-actions" },
  { label: "Mass Approve", icon: BadgeCheck, desc: "Process the approval queue", to: "/affiliate-manager/bulk-actions" },
  { label: "Import Center", icon: Upload, desc: "Affiliates, links, codes, campaigns, payouts", to: "/affiliate-manager/import" },
  { label: "Export Center", icon: Download, desc: "CSV, XLSX, JSON with filters & schedule", to: "/affiliate-manager/export" },
];

export function RightActionPanel({ trigger }: { trigger: ReactNode }) {
  const { data: perms } = usePermissions();
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-surface">
        <SheetHeader className="border-b border-border px-4 py-3 space-y-0">
          <SheetTitle className="font-display text-base flex items-center gap-2">
            <Plus className="size-4" /> Quick Create
          </SheetTitle>
        </SheetHeader>
        <Tabs items={["Create", "Bulk Ops", "Recent"]} />
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <Section title="Create">
            {create.map((it) => <ActionRow key={it.label} item={it} perms={perms} />)}
          </Section>
          <Section title="Bulk Operations">
            {ops.map((it) => <ActionRow key={it.label} item={it} perms={perms} />)}
          </Section>
        </div>
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {perms?.authenticated ? `Role: ${perms.roles.join(", ") || "none"}` : "Sign in for actions"}
          </span>
          <Button size="sm" variant="outline">Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ActionRow({
  item,
  perms,
}: {
  item: Item;
  perms: ReturnType<typeof usePermissions>["data"];
}) {
  const { label, icon: Icon, desc, to } = item;
  const required = QUICK_ACTION_PERMISSIONS[label] as Permission | undefined;
  const allowed = !required || can(perms, required);
  const cls = "group flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors";
  const body = (
    <>
      <div className={`grid size-9 place-items-center rounded-md ${allowed ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}>
        {allowed ? <Icon className="size-4" /> : <Lock className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground flex items-center gap-2">
          {label}
          {!allowed && required && (
            <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-normal text-destructive">
              403
            </span>
          )}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {allowed ? desc : `Requires ${required} permission`}
        </div>
      </div>
    </>
  );
  if (!allowed) {
    return (
      <button
        type="button"
        className={`${cls} cursor-not-allowed opacity-60`}
        onClick={() =>
          toast.error("Permission denied", {
            description: `You need "${required}" to run "${label}".`,
          })
        }
      >
        {body}
      </button>
    );
  }
  if (to) return <Link to={to} className={`${cls} hover:border-border-strong hover:bg-muted/40`}>{body}</Link>;
  return <button type="button" className={`${cls} hover:border-border-strong hover:bg-muted/40`}>{body}</button>;
}
