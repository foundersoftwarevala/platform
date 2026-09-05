import { useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  Edit,
  Play,
  Pause,
  MessageSquare,
  Mail,
  Receipt,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Workflow,
} from "lucide-react";
import { PageHeader, GlassCard, StatCard, StatusBadge } from "../primitives";
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

export default function TrafficAutomationScreen() {
  const [workflows, setWorkflows] = useState<any[]>([
    {
      id: 1,
      name: "Auto Reply to New Leads",
      type: "email",
      status: "active",
      triggered: 1240,
      lastRun: "2 minutes ago",
    },
    {
      id: 2,
      name: "Invoice on Order",
      type: "invoice",
      status: "active",
      triggered: 845,
      lastRun: "5 minutes ago",
    },
    {
      id: 3,
      name: "Weekly Report Auto-Send",
      type: "email",
      status: "active",
      triggered: 12,
      lastRun: "1 day ago",
    },
  ]);

  const [campaigns, setCampaigns] = useState<any[]>([
    {
      id: 1,
      title: "Welcome Series",
      posts: 3,
      schedule: "Daily",
      published: 45,
    },
    {
      id: 2,
      title: "Feature Highlights",
      posts: 5,
      schedule: "3x Weekly",
      published: 28,
    },
  ]);

  const stats = [
    { label: "Active Workflows", value: 12, tone: "primary" },
    { label: "Automations Triggered", value: "2,847", tone: "cyan" },
    { label: "Time Saved (hrs)", value: "156", tone: "green" },
    { label: "Error Rate", value: "0.2%", tone: "amber" },
  ];

  return (
    <>
      <PageHeader
        title="Traffic & Automation"
        description="Auto-reply, auto-invoice, email workflows, and social automation"
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard
              key={i}
              label={s.label}
              value={s.value}
              tone={s.tone as any}
              icon={[<Zap className="h-4 w-4" />, <BarChart3 className="h-4 w-4" />, <Clock className="h-4 w-4" />, <AlertCircle className="h-4 w-4" />][i]}
            />
          ))}
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
            <GlassCard
              title="Automation Workflows"
              actions={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New Workflow
                </Button>
              }
            >
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
                        <TableRow key={wf.id}>
                          <TableCell className="font-medium">{wf.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{wf.type}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{wf.triggered}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {wf.lastRun}
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={wf.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button className="text-muted-foreground hover:text-foreground">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button className="text-muted-foreground hover:text-foreground">
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
                  <input type="checkbox" id="active" />
                  <label htmlFor="active" className="text-sm">
                    Enable auto-reply
                  </label>
                </div>
                <Button>
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
                      <input type="checkbox" id="order" defaultChecked />
                      <label htmlFor="order" className="text-sm">
                        Order Completion
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="payment" defaultChecked />
                      <label htmlFor="payment" className="text-sm">
                        Payment Received
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="subscription" />
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
                <Button>
                  <Receipt className="mr-2 h-4 w-4" /> Configure Invoicing
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Email Sequences Tab */}
          <TabsContent value="emails">
            <GlassCard title="Email Sequence Manager">
              <div className="space-y-4">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create Sequence
                </Button>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">Example Sequence:</p>
                  <ol className="mt-2 space-y-2 text-sm">
                    <li>Day 0: Welcome email</li>
                    <li>Day 2: Product overview</li>
                    <li>Day 5: Case study</li>
                    <li>Day 7: Special offer</li>
                    <li>Day 14: Win-back offer</li>
                  </ol>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Social Posts Tab */}
          <TabsContent value="social">
            <GlassCard
              title="Auto Social Media Posts"
              actions={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Schedule Post
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Posts</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="text-right">Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((camp) => (
                      <TableRow key={camp.id}>
                        <TableCell className="font-medium">{camp.title}</TableCell>
                        <TableCell className="text-right">{camp.posts}</TableCell>
                        <TableCell>{camp.schedule}</TableCell>
                        <TableCell className="text-right">{camp.published}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <GlassCard title="Automation Analytics">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold text-primary">2,847</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-status-success">99.8%</p>
                </div>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm text-muted-foreground">Failures</p>
                  <p className="text-2xl font-bold text-status-error">6</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
