import { createFileRoute } from "@tanstack/react-router";
import {
  Settings as SettingsIcon, Wallet, Megaphone, Workflow, Bell, Mail, MessageSquare,
  Palette, KeyRound, Plug, ShieldCheck, DatabaseBackup, Activity, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { SectionCard } from "@/components/affiliate/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/affiliate-manager/settings")({
  head: () => ({ meta: [{ title: "Settings — Affiliate Manager" }] }),
  component: SettingsWall,
});

const groups: { title: string; items: { icon: LucideIcon; label: string; desc: string }[] }[] = [
  {
    title: "Rules & Workflow",
    items: [
      { icon: Wallet, label: "Commission Rules", desc: "Plans, tiers, recurring, adjustments" },
      { icon: Megaphone, label: "Referral & Campaign Rules", desc: "Levels, attribution, eligibility" },
      { icon: Workflow, label: "Approval Workflow", desc: "Applications, payouts, content" },
      { icon: Workflow, label: "Automation Rules", desc: "Triggers, conditions, actions" },
    ],
  },
  {
    title: "Templates & Notifications",
    items: [
      { icon: Bell, label: "Notification Templates", desc: "In-app and push templates" },
      { icon: Mail, label: "Email Templates", desc: "Transactional and marketing" },
      { icon: MessageSquare, label: "WhatsApp / SMS Templates", desc: "Approved messaging templates" },
    ],
  },
  {
    title: "Brand & Integrations",
    items: [
      { icon: Palette, label: "Brand Settings", desc: "Logo, palette, domain, locale" },
      { icon: KeyRound, label: "API Keys", desc: "Issue, rotate, revoke" },
      { icon: Plug, label: "Integrations", desc: "Payments, CRM, analytics, comms" },
    ],
  },
  {
    title: "Security & Operations",
    items: [
      { icon: ShieldCheck, label: "Security", desc: "Roles, permissions, 2FA, IP rules" },
      { icon: DatabaseBackup, label: "Backup", desc: "Snapshots and restore points" },
      { icon: SettingsIcon, label: "Audit", desc: "System and admin audit trails" },
      { icon: Activity, label: "System Health", desc: "Queues, jobs, uptime" },
    ],
  },
];

function SettingsWall() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure rules, templates, brand, API, integrations, security and system health."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Settings" }]}
        actions={<Button size="sm">Save Changes</Button>}
      />
      <WallShell>
        {groups.map((g) => (
          <SectionCard key={g.title} title={g.title}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((it) => (
                <button
                  key={it.label}
                  className="group flex items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong hover:bg-muted/40"
                >
                  <div className="grid size-9 place-items-center rounded-md bg-primary-soft text-primary">
                    <it.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{it.label}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{it.desc}</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </SectionCard>
        ))}
      </WallShell>
    </>
  );
}
