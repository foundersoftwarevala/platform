import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users, Mail, Target, Search, Trash2, Edit, Filter, Zap, BarChart3 } from "lucide-react";
import {
  PageHeader,
  GlassCard,
  StatCard,
  EmptyState,
  ErrorState,
  LoadingBlock,
  formatDate,
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
import { directDb, must, useDirectRead, type Row } from "@/lib/manager-queries";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Lead Generation reads the platform's real lead records (`leads`, the same
 * table Lead Manager works) and the email campaign records
 * (`seo_email_campaigns`). Lead finding, enrichment and LinkedIn import have no
 * provider behind them, so they say so instead of showing numbers.
 */

async function readLeadStats() {
  const count = (
    q: PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }>,
  ) => must(q).then((r) => r.count ?? 0);
  const head = () => directDb.from("leads").select("id", { count: "exact", head: true });
  const [total, hot, score90, won, scores] = await Promise.all([
    count(head()),
    count(head().eq("temperature", "hot")),
    count(head().gte("ai_score", 90)),
    count(head().eq("status", "won")),
    must<Row[]>(
      directDb.from("leads").select("ai_score").not("ai_score", "is", null).limit(10_000),
    ),
  ]);
  const values = (scores.data ?? []).map((r) => Number(r["ai_score"])).filter(Number.isFinite);
  return {
    total,
    hot,
    score90,
    won,
    avgScore:
      values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
  };
}

function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export default function LeadGeneratorScreen() {
  const { t } = useTranslation();
  const NO_FINDER = t("manager.console.no_lead_finder");
  const NO_ENRICHMENT = t("manager.console.no_enrichment");
  const NO_LINKEDIN = t("manager.console.no_linkedin");
  const DELETE_REASON = t("manager.console.lead_delete_reason");
  const [filter, setFilter] = useState("");

  const statsQuery = useDirectRead(["lead-generator", "stats"], readLeadStats);
  const leadsQuery = useDirectRead(
    ["lead-generator", "leads"],
    async () =>
      (
        await must<Row[]>(
          directDb
            .from("leads")
            .select("id,name,email,company,ai_score,temperature,status,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
        )
      ).data ?? [],
  );
  const campaignsQuery = useDirectRead(
    ["lead-generator", "campaigns"],
    async () =>
      (
        await must<Row[]>(
          directDb
            .from("seo_email_campaigns")
            .select("id,name,status,sent_count,opened_count,clicked_count")
            .order("created_at", { ascending: false })
            .limit(100),
        )
      ).data ?? [],
  );

  const leads = leadsQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const stats = statsQuery.data;

  const visibleLeads = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      ["name", "email", "company", "status", "temperature"].some((k) =>
        String(l[k] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [leads, filter]);

  const dash = statsQuery.isLoading ? "…" : "—";

  return (
    <>
      <PageHeader
        title="Lead Generation & CRM"
        description="Find, score, and nurture leads across all channels"
      />

      <div className="space-y-6">
        {statsQuery.error ? (
          <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
        ) : null}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("manager.console.total_leads")}
            value={stats ? num(stats.total) : dash}
            tone="primary"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label={t("manager.console.hot_leads")}
            value={stats ? num(stats.hot) : dash}
            tone="red"
            icon={<Target className="h-4 w-4" />}
          />
          <StatCard
            label={t("manager.console.avg_lead_score")}
            value={stats?.avgScore != null ? String(stats.avgScore) : dash}
            tone="cyan"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <StatCard
            label={t("manager.console.enrichment_rate")}
            value="—"
            tone="green"
            icon={<Zap className="h-4 w-4" />}
            change={t("manager.console.not_tracked")}
          />
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
            <GlassCard title="Lead Database">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Filter leads..."
                    className="flex-1"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="Filter leads"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Clear filter"
                    onClick={() => setFilter("")}
                    disabled={!filter}
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>

                {leadsQuery.isLoading ? (
                  <LoadingBlock />
                ) : leadsQuery.error ? (
                  <ErrorState error={leadsQuery.error} onRetry={() => leadsQuery.refetch()} />
                ) : visibleLeads.length === 0 ? (
                  <EmptyState
                    message={
                      filter ? t("manager.console.no_leads_match") : t("manager.console.no_leads")
                    }
                  />
                ) : (
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
                        {visibleLeads.map((lead) => {
                          const temperature = String(lead["temperature"] ?? "");
                          return (
                            <TableRow key={String(lead["id"])}>
                              <TableCell className="font-medium">
                                {String(lead["name"] ?? "—")}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {String(lead["email"] ?? "—")}
                              </TableCell>
                              <TableCell>{String(lead["company"] ?? "—")}</TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-primary">
                                  {lead["ai_score"] == null ? "—" : String(lead["ai_score"])}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  title={t("manager.console.lead_status_added", {
                                    status: String(lead["status"] ?? ""),
                                    date: formatDate(lead["created_at"] as string | null),
                                  })}
                                  className={
                                    temperature === "hot"
                                      ? "border-status-error/40 bg-status-error/15 text-status-error"
                                      : temperature === "warm"
                                        ? "border-status-warning/40 bg-status-warning/15 text-status-warning"
                                        : "border-status-success/40 bg-status-success/15 text-status-success"
                                  }
                                >
                                  {temperature || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Link
                                    to="/lead-manager"
                                    aria-label={t("manager.console.open_in_lead_manager", {
                                      name: String(lead["name"] ?? "lead"),
                                    })}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Link>
                                  <button
                                    type="button"
                                    disabled
                                    title={DELETE_REASON}
                                    aria-label={t("manager.console.delete_with_reason", {
                                      reason: DELETE_REASON,
                                    })}
                                    className="cursor-not-allowed text-muted-foreground opacity-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
                    <Input placeholder="e.g., API managers, software founders..." disabled />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Industry</label>
                      <Input placeholder="Select industry..." disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Company Size</label>
                      <Input placeholder="10-100, 100-1000..." disabled />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("manager.console.not_connected_reason", { reason: NO_FINDER })}
                </p>
                <Button className="w-full" disabled title={NO_FINDER}>
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
                  <p className="text-sm font-medium">
                    {t("manager.console.enriched_not_tracked", { reason: NO_ENRICHMENT })}
                  </p>
                </div>
                <Button disabled title={NO_ENRICHMENT}>
                  <Zap className="mr-2 h-4 w-4" /> Start Enrichment
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Email Campaigns Tab */}
          <TabsContent value="campaigns">
            <GlassCard title="Email Campaigns">
              {campaignsQuery.isLoading ? (
                <LoadingBlock />
              ) : campaignsQuery.error ? (
                <ErrorState error={campaignsQuery.error} onRetry={() => campaignsQuery.refetch()} />
              ) : campaigns.length === 0 ? (
                <EmptyState message={t("manager.console.no_campaigns")} />
              ) : (
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
                      {campaigns.map((camp) => {
                        const sent = Number(camp["sent_count"] ?? 0);
                        const opened = Number(camp["opened_count"] ?? 0);
                        return (
                          <TableRow key={String(camp["id"])}>
                            <TableCell className="font-medium">
                              {String(camp["name"] ?? "—")}
                            </TableCell>
                            <TableCell className="text-right">{num(sent)}</TableCell>
                            <TableCell className="text-right">{num(opened)}</TableCell>
                            <TableCell className="text-right">
                              {num(Number(camp["clicked_count"] ?? 0))}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-status-success">
                              {pct(opened, sent)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          </TabsContent>

          {/* LinkedIn Tab */}
          <TabsContent value="linkedin">
            <GlassCard title="LinkedIn Integration">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect and auto-import LinkedIn contacts
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("manager.console.status_not_connected")}
                </p>
                <Button disabled title={NO_LINKEDIN}>
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
                    <p className="text-2xl font-bold text-primary">
                      {stats?.avgScore != null ? String(stats.avgScore) : dash}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Hot Leads (90+)</p>
                    <p className="text-2xl font-bold text-status-error">
                      {stats ? num(stats.score90) : dash}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                    <p className="text-2xl font-bold text-status-success">
                      {stats ? pct(stats.won, stats.total) : dash}
                    </p>
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
