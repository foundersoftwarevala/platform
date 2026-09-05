import { useState } from "react";
import {
  Users,
  Mail,
  Target,
  Search,
  Download,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Filter,
  Upload,
  Zap,
  BarChart3,
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

export default function LeadGeneratorScreen() {
  const [leads, setLeads] = useState<any[]>([
    {
      id: 1,
      name: "John Smith",
      email: "john@techcorp.com",
      company: "TechCorp Inc",
      score: 92,
      status: "hot",
      added: "2 days ago",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      email: "sarah@startupai.com",
      company: "StartupAI",
      score: 78,
      status: "warm",
      added: "5 days ago",
    },
    {
      id: 3,
      name: "Mike Davis",
      email: "mike@enterprise.com",
      company: "Enterprise Solutions",
      score: 65,
      status: "cold",
      added: "1 week ago",
    },
  ]);

  const [campaigns, setCampaigns] = useState<any[]>([
    {
      id: 1,
      name: "Tech Founders Q4 2026",
      sent: 1240,
      opened: 485,
      clicked: 128,
      rate: "39%",
    },
    {
      id: 2,
      name: "API Managers Campaign",
      sent: 890,
      opened: 356,
      clicked: 94,
      rate: "40%",
    },
  ]);

  const stats = [
    { label: "Total Leads", value: 3450, tone: "primary" },
    { label: "Hot Leads", value: 342, tone: "red" },
    { label: "Avg Lead Score", value: "78", tone: "cyan" },
    { label: "Enrichment Rate", value: "94%", tone: "green" },
  ];

  return (
    <>
      <PageHeader
        title="Lead Generation & CRM"
        description="Find, score, and nurture leads across all channels"
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
              icon={[
                <Users className="h-4 w-4" />,
                <Target className="h-4 w-4" />,
                <BarChart3 className="h-4 w-4" />,
                <Zap className="h-4 w-4" />,
              ][i]}
            />
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">
              <Users className="mr-2 h-4 w-4" /> Lead Database
            </TabsTrigger>
            <TabsTrigger value="finder">
              <Search className="mr-2 h-4 w-4" /> Lead Finder
            </TabsTrigger>
            <TabsTrigger value="enrichment">
              <Zap className="mr-2 h-4 w-4" /> Enrichment
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Mail className="mr-2 h-4 w-4" /> Email Campaigns
            </TabsTrigger>
            <TabsTrigger value="linkedin">
              <Users className="mr-2 h-4 w-4" /> LinkedIn
            </TabsTrigger>
            <TabsTrigger value="scoring">
              <BarChart3 className="mr-2 h-4 w-4" /> Lead Scoring
            </TabsTrigger>
          </TabsList>

          {/* Lead Database Tab */}
          <TabsContent value="leads">
            <GlassCard
              title="Lead Database"
              actions={
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Upload className="mr-2 h-4 w-4" /> Import
                  </Button>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Lead
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Filter leads..." className="flex-1" />
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell className="font-mono text-sm">{lead.email}</TableCell>
                          <TableCell>{lead.company}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-primary">{lead.score}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                lead.status === "hot"
                                  ? "border-status-error/40 bg-status-error/15 text-status-error"
                                  : lead.status === "warm"
                                    ? "border-status-warning/40 bg-status-warning/15 text-status-warning"
                                    : "border-status-success/40 bg-status-success/15 text-status-success"
                              }
                            >
                              {lead.status}
                            </Badge>
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

          {/* Lead Finder Tab */}
          <TabsContent value="finder">
            <GlassCard title="AI Lead Finder">
              <div className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Search Keywords</label>
                    <Input placeholder="e.g., API managers, software founders..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Industry</label>
                      <Input placeholder="Select industry..." />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Company Size</label>
                      <Input placeholder="10-100, 100-1000..." />
                    </div>
                  </div>
                </div>
                <Button className="w-full">
                  <Search className="mr-2 h-4 w-4" /> Find Leads
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Enrichment Tab */}
          <TabsContent value="enrichment">
            <GlassCard title="Lead Enrichment">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Auto-enrich lead data with company info, job titles, and contact details
                </p>
                <div className="rounded-lg bg-surface p-4">
                  <p className="text-sm font-medium">Enriched This Month: 1,245 leads</p>
                </div>
                <Button>
                  <Zap className="mr-2 h-4 w-4" /> Start Enrichment
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Email Campaigns Tab */}
          <TabsContent value="campaigns">
            <GlassCard title="Email Campaigns">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Opened</TableHead>
                      <TableHead className="text-right">Clicked</TableHead>
                      <TableHead className="text-right">Open Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((camp) => (
                      <TableRow key={camp.id}>
                        <TableCell className="font-medium">{camp.name}</TableCell>
                        <TableCell className="text-right">{camp.sent}</TableCell>
                        <TableCell className="text-right">{camp.opened}</TableCell>
                        <TableCell className="text-right">{camp.clicked}</TableCell>
                        <TableCell className="text-right font-semibold text-status-success">
                          {camp.rate}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </TabsContent>

          {/* LinkedIn Tab */}
          <TabsContent value="linkedin">
            <GlassCard title="LinkedIn Integration">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect and auto-import LinkedIn contacts
                </p>
                <Button>
                  <Users className="mr-2 h-4 w-4" /> Connect LinkedIn Account
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Lead Scoring Tab */}
          <TabsContent value="scoring">
            <GlassCard title="Lead Scoring & Qualification">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  AI-powered lead scoring based on engagement, company data, and behavior
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                    <p className="text-2xl font-bold text-primary">78</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Hot Leads (90+)</p>
                    <p className="text-2xl font-bold text-status-error">342</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                    <p className="text-2xl font-bold text-status-success">18%</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
