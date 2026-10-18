import { Link } from "@tanstack/react-router";
import {
  Zap,
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  Mail,
  Receipt,
  BarChart3,
  Clock,
  AlertCircle,
  Workflow,
} from "lucide-react";
import {
  PageHeader,
  GlassCard,
  StatCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDateTime,
  num,
} from "../primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRecords, type Row } from "@/lib/manager-queries";

/**
 * Traffic & Automation reads the real automation_rules table (the same rules
 * the Registry and Alerts screens toggle). Auto-reply, auto-invoice, email
 * sequences and social posting have no engine behind this console, so they
 * show "Not connected" and their controls are disabled with that reason.
 */
const NOT_CONNECTED = "No automation engine for this is connected to this console.";
const DELETE_REASON = "Automation rules are paused in the Registry, not deleted.";

function isEnabled(rule: Row): boolean {
  return Boolean(rule["is_enabled"] ?? rule["enabled"]);
}

/**
 * automation_rules carries two run counters: run_count (legacy, unused) and
 * runs_count (the one the rule engine increments). Take whichever is recorded.
 */
function runs(rule: Row): number {
  const a = Number(rule["runs_count"] ?? 0);
  const b = Number(rule["run_count"] ?? 0);
  return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
}

export default function TrafficAutomationScreen() {
  const rulesQuery = useRecords({
    table: "automation_rules",
    select:
      "id,name,scope,trigger_type,trigger_event,action_type,enabled,is_enabled,run_count,runs_count,last_run_at,created_at",
    orderBy: "created_at",
    limit: 300,
  });
  const workflows = rulesQuery.data ?? [];
  const loaded = !rulesQuery.isLoading && !rulesQuery.error;
  const dash = rulesQuery.isLoading ? "…" : "—";
  const totalRuns = workflows.reduce((sum, r) => sum + runs(r), 0);

  return (
    <>
      <PageHeader
        title="Traffic & Automation"
        description="Auto-reply, auto-invoice, email workflows, and social automation"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        {rulesQuery.error ? (
          <ErrorState error={rulesQuery.error} onRetry={() => rulesQuery.refetch()} />
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Workflows"
            value={loaded ? num(workflows.filter(isEnabled).length) : dash}
            tone="primary"
            icon={<Zap className="h-4 w-4" />}
            change={loaded ? `${num(workflows.length)} rules` : undefined}
          />
          <StatCard
            label="Automations Triggered"
            value={loaded ? num(totalRuns) : dash}
            tone="cyan"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <StatCard
            label="Time Saved (hrs)"
            value="—"
            tone="green"
            icon={<Clock className="h-4 w-4" />}
            change="Not tracked"
          />
          <StatCard
            label="Error Rate"
            value="—"
            tone="amber"
            icon={<AlertCircle className="h-4 w-4" />}
            change="Not tracked"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="workflows" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workflows">
              <Workflow className="mr-2 h-4 w-4" /> Workflows
            </TabsTrigger>
            <TabsTrigger value="autoreply">
              <MessageSquare className="mr-2 h-4 w-4" /> Auto Reply
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="mr-2 h-4 w-4" /> Auto Invoice
            </TabsTrigger>
            <TabsTrigger value="emails">
              <Mail className="mr-2 h-4 w-4" /> Email Sequences
            </TabsTrigger>
            <TabsTrigger value="social">
              <Zap className="mr-2 h-4 w-4" /> Social Posts
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" /> Analytics
            </TabsTrigger>
          </TabsList>

          {/* Workflows Tab */}
          <TabsContent value="workflows">
            <GlassCard title="Automation Workflows">
              {rulesQuery.isLoading ? (
                <LoadingBlock />
              ) : rulesQuery.error ? (
                <ErrorState error={rulesQuery.error} onRetry={() => rulesQuery.refetch()} />
              ) : workflows.length === 0 ? (
                <EmptyState message="No automation rules are defined." />
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Workflow</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Triggered</TableHead>
                          <TableHead>Last Run</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workflows.map((wf) => (
                          <TableRow key={String(wf["id"])}>
                            <TableCell className="font-medium">
                              {String(wf["name"] ?? "—")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {String(
                                  wf["scope"] ?? wf["trigger_event"] ?? wf["trigger_type"] ?? "—",
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{num(runs(wf))}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTime(wf["last_run_at"] as string | null)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge value={isEnabled(wf) ? "active" : "paused"} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Link
                                  to="/manager/$section"
                                  params={{ section: "registry" }}
                                  aria-label={`Manage ${String(wf["name"] ?? "rule")} in the Registry`}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Edit className="h-4 w-4" />
                                </Link>
                                <button
                                  type="button"
                                  disabled
                                  title={DELETE_REASON}
                                  aria-label={`Delete — ${DELETE_REASON}`}
                                  className="cursor-not-allowed text-muted-foreground opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* Auto Reply Tab */}
          <TabsContent value="autoreply">
            <GlassCard title="Auto Reply Configuration">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Trigger (When...)</label>
                  <Input placeholder="New lead received, Email to support..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Response Message</label>
                  <textarea
                    placeholder="Your auto-reply message..."
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2"
                  />
                </div>
                <div className="flex gap-2">
                  <input type="checkbox" id="active" disabled />
                  <label htmlFor="active" className="text-sm">
                    Enable auto-reply
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Not connected: {NOT_CONNECTED}</p>
                <Button disabled title={NOT_CONNECTED}>
                  <Zap className="mr-2 h-4 w-4" /> Save Auto Reply
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Auto Invoice Tab */}
          <TabsContent value="invoices">
            <GlassCard title="Auto Invoice Settings">
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">Auto-generate invoices on:</p>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="order" disabled />
                      <label htmlFor="order" className="text-sm">
                        Order Completion
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="payment" disabled />
                      <label htmlFor="payment" className="text-sm">
                        Payment Received
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="subscription" disabled />
                      <label htmlFor="subscription" className="text-sm">
                        Subscription Renewal
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Invoice Template</label>
                  <Input placeholder="Select template..." />
                </div>
                <p className="text-xs text-muted-foreground">Not configured: {NOT_CONNECTED}</p>
                <Button disabled title={NOT_CONNECTED}>
                  <Receipt className="mr-2 h-4 w-4" /> Configure Invoicing
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Email Sequences Tab */}
          <TabsContent value="emails">
            <GlassCard title="Email Sequence Manager">
              <div className="space-y-4">
                <Button disabled title={NOT_CONNECTED}>
                  <Plus className="mr-2 h-4 w-4" /> Create Sequence
                </Button>
                <EmptyState message={`No email sequences are configured. ${NOT_CONNECTED}`} />
              </div>
            </GlassCard>
          </TabsContent>

          {/* Social Posts Tab */}
          <TabsContent value="social">
            <GlassCard title="Auto Social Media Posts">
              <EmptyState message={`No social posting is connected. ${NOT_CONNECTED}`} />
            </GlassCard>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <GlassCard title="Automation Analytics">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold text-primary">
                    {loaded ? num(totalRuns) : dash}
                  </p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-status-success">—</p>
                  <p className="text-xs text-muted-foreground">Not tracked</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Failures</p>
                  <p className="text-2xl font-bold text-status-error">—</p>
                  <p className="text-xs text-muted-foreground">Not tracked</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
