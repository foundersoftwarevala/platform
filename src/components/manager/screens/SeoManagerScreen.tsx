import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  FileText,
  Link as LinkIcon,
  Map as MapIcon,
  Plus,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { GlassCard, LoadingBlock, PageHeader, StatCard, StatusBadge } from "../primitives";
import { useManyRecords } from "@/lib/manager-queries";
import { seoQueries } from "@/lib/seo-queries";
import { useRecordActions } from "@/lib/use-seo-actions";

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayNumber(value: unknown): string {
  return numeric(value).toLocaleString();
}

export default function SeoManagerScreen() {
  const [keyword, setKeyword] = useState("");
  const keywordQuery = useQuery(seoQueries.keywords());
  const backlinkQuery = useQuery(seoQueries.backlinks());
  const competitorQuery = useQuery(seoQueries.competitors());
  const issueQuery = useQuery(seoQueries.issues());
  const regionQuery = useQuery(seoQueries.regions());
  const actions = useRecordActions();
  const registry = useManyRecords([
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "api_service_capabilities", orderBy: "capability_name", ascending: true, limit: 2000 },
    { table: "api_keys", orderBy: "created_at", ascending: false, limit: 500 },
  ]);

  const keywords = keywordQuery.data ?? [];
  const backlinks = backlinkQuery.data ?? [];
  const competitors = competitorQuery.data ?? [];
  const issues = issueQuery.data ?? [];
  const regions = regionQuery.data ?? [];
  const [services = [], capabilities = [], keys = []] = registry.data ?? [];
  const seoServices = services.filter((service) =>
    /seo|search|webmaster|index|analytics|social/i.test(String(service["category"] ?? "")),
  );
  const configuredServiceIds = useMemo(
    () =>
      new Set(
        keys
          .filter((key) => key["status"] === "active" && key["service_id"])
          .map((key) => String(key["service_id"])),
      ),
    [keys],
  );
  const activeSeoServices = seoServices.filter((service) => {
    const serviceId = String(service["id"]);
    return (
      service["status"] === "active" &&
      service["approval_status"] === "approved" &&
      configuredServiceIds.has(serviceId)
    );
  });
  const canDisplayLiveSeoData = activeSeoServices.length > 0;
  const averagePosition = useMemo(() => {
    const ranked = keywords.filter((row) => numeric(row.position) > 0);
    return ranked.length
      ? ranked.reduce((total, row) => total + numeric(row.position), 0) / ranked.length
      : null;
  }, [keywords]);
  const activeBacklinks = backlinks.filter((row) => row.status === "active").length;
  const openIssues = issues.filter(
    (row) => row.status !== "resolved" && row.status !== "ignored",
  ).length;
  const topTen = keywords.filter((row) => {
    const position = numeric(row.position);
    return position > 0 && position <= 10;
  }).length;

  const addKeyword = () => {
    const value = keyword.trim();
    if (!value) return;
    actions.insert.mutate({
      table: "seo_keywords",
      values: { keyword: value, region: "global", status: "tracking", position: 0 },
    });
    setKeyword("");
  };

  const loading =
    keywordQuery.isLoading ||
    backlinkQuery.isLoading ||
    competitorQuery.isLoading ||
    issueQuery.isLoading ||
    regionQuery.isLoading ||
    registry.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global SEO Tools"
        description="Live keyword, backlink, competitor, technical SEO, and central API registry visibility."
      />

      {loading ? <LoadingBlock rows={6} /> : null}

      <GlassCard
        title="Central AI/API Manager connection"
        icon={<BarChart3 className="h-4 w-4 text-primary" />}
      >
        {registry.error ? (
          <p className="text-sm text-status-error">
            Registry data could not be loaded: {registry.error.message}
          </p>
        ) : seoServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No SEO-capable services are registered in the central AI/API Manager yet. This is not an
            active integration state.
          </p>
        ) : (
          <div className="space-y-2">
            {seoServices.map((service) => {
              const serviceId = String(service["id"]);
              const serviceCapabilities = capabilities.filter(
                (capability) => String(capability["service_id"]) === serviceId,
              );
              const credentialReady = configuredServiceIds.has(serviceId);
              return (
                <div
                  key={serviceId}
                  className="flex flex-col gap-2 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{String(service["name"])}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(service["pricing_tier"] ?? "unknown")} ·{" "}
                      {String(service["auth_type"] ?? "not specified")} ·{" "}
                      {serviceCapabilities.length} capabilities
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={String(service["status"] ?? "inactive")} />
                    <StatusBadge value={String(service["approval_status"] ?? "pending")} />
                    <Badge
                      variant="outline"
                      className={
                        credentialReady
                          ? "border-status-success/40 text-status-success"
                          : "border-amber-500/40 text-amber-600"
                      }
                    >
                      {credentialReady ? "Credential configured" : "BLOCKED / CREDENTIAL REQUIRED"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {!canDisplayLiveSeoData ? (
        <GlassCard title="Live SEO data unavailable">
          <p className="text-sm text-muted-foreground">
            SEO metrics and records are withheld until an approved, active central registry service
            has configured credentials. Existing stored SEO data is not presented as live provider
            data.
          </p>
        </GlassCard>
      ) : (
        <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Keywords tracked"
          value={displayNumber(keywords.length)}
          tone="primary"
          icon={<Search className="h-4 w-4" />}
        />
        <StatCard
          label="Average position"
          value={averagePosition === null ? "Not available" : averagePosition.toFixed(1)}
          tone="cyan"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Active backlinks"
          value={displayNumber(activeBacklinks)}
          tone="green"
          icon={<LinkIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Open SEO issues"
          value={displayNumber(openIssues)}
          tone="amber"
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      <Tabs defaultValue="keywords" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="keywords">
            <Search className="mr-2 h-4 w-4" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="ranking">
            <TrendingUp className="mr-2 h-4 w-4" />
            Rank Tracking
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Target className="mr-2 h-4 w-4" />
            Competitors
          </TabsTrigger>
          <TabsTrigger value="backlinks">
            <LinkIcon className="mr-2 h-4 w-4" />
            Backlinks
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="mr-2 h-4 w-4" />
            Site Audit
          </TabsTrigger>
          <TabsTrigger value="local">
            <MapIcon className="mr-2 h-4 w-4" />
            Local SEO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keywords">
          <GlassCard title="Keyword research & tracking">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Add new keyword..."
                  className="flex-1"
                />
                <Button onClick={addKeyword} disabled={!keyword.trim() || actions.insert.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Keyword
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Difficulty</TableHead>
                      <TableHead className="text-right">Rank</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.slice(0, 100).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.keyword}</TableCell>
                        <TableCell>{row.country || "Global"}</TableCell>
                        <TableCell className="text-right">
                          {displayNumber(row.search_volume)}
                        </TableCell>
                        <TableCell className="text-right">
                          {displayNumber(row.difficulty)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numeric(row.position) || "Not recorded"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={String(row.status)} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!keywords.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No keyword data recorded.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="ranking">
          <GlassCard title="SERP rank tracking">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Average position"
                value={averagePosition === null ? "Not available" : averagePosition.toFixed(1)}
                tone="primary"
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <StatCard
                label="Keywords in top 10"
                value={displayNumber(topTen)}
                tone="green"
                icon={<Target className="h-4 w-4" />}
              />
              <StatCard
                label="Ranked keywords"
                value={displayNumber(keywords.filter((row) => numeric(row.position) > 0).length)}
                tone="cyan"
                icon={<Search className="h-4 w-4" />}
              />
            </div>
          </GlassCard>
        </TabsContent>
        <TabsContent value="competitors">
          <GlassCard title="Competitor analysis">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-right">Visibility</TableHead>
                    <TableHead className="text-right">Keywords</TableHead>
                    <TableHead className="text-right">Backlinks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.domain}</TableCell>
                      <TableCell className="text-right">
                        {numeric(row.visibility_score).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayNumber(row.keywords_count)}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayNumber(row.backlinks_count)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!competitors.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No competitor data recorded.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        <TabsContent value="backlinks">
          <GlassCard title="Backlink monitor">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source domain</TableHead>
                    <TableHead>Target URL</TableHead>
                    <TableHead className="text-right">Authority</TableHead>
                    <TableHead className="text-right">Spam score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backlinks.slice(0, 100).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.source_domain}</TableCell>
                      <TableCell>{row.target_url}</TableCell>
                      <TableCell className="text-right">
                        {displayNumber(row.domain_authority)}
                      </TableCell>
                      <TableCell className="text-right">{displayNumber(row.spam_score)}</TableCell>
                      <TableCell>
                        <StatusBadge value={String(row.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!backlinks.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No backlink data recorded.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        <TabsContent value="audit">
          <GlassCard title="Site audit issues">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.slice(0, 100).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.issue_type}</TableCell>
                      <TableCell>{row.page_url}</TableCell>
                      <TableCell>
                        <StatusBadge value={String(row.severity)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={String(row.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!issues.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No site-audit issues recorded.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
        <TabsContent value="local">
          <GlassCard title="Local & regional SEO">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Keywords</TableHead>
                    <TableHead className="text-right">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.name || row.region || row.country_code}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayNumber(row.keywords_count)}
                      </TableCell>
                      <TableCell className="text-right">
                        {numeric(row.average_position) || "Not recorded"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!regions.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No regional SEO data recorded.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}
