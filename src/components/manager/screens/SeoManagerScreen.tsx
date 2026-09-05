import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Link as LinkIcon,
  FileText,
  Code,
  Map as MapIcon,
  Zap,
  Search,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle,
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

export default function SeoManagerScreen() {
  const [keywords, setKeywords] = useState<any[]>([
    {
      id: 1,
      keyword: "software API management",
      volume: 2400,
      difficulty: 35,
      rank: 8,
      trend: "up",
    },
    {
      id: 2,
      keyword: "AI API gateway",
      volume: 1800,
      difficulty: 42,
      rank: 12,
      trend: "down",
    },
    {
      id: 3,
      keyword: "API cost optimization",
      volume: 950,
      difficulty: 28,
      rank: 5,
      trend: "up",
    },
  ]);

  const [competitors, setCompetitors] = useState<any[]>([
    { id: 1, name: "CompetitorA", score: 78, backlinks: 2450, keywords: 1850 },
    { id: 2, name: "CompetitorB", score: 71, backlinks: 1890, keywords: 1420 },
    { id: 3, name: "CompetitorC", score: 65, backlinks: 1240, keywords: 980 },
  ]);

  const stats = [
    { label: "Keywords Tracked", value: 128, tone: "primary" },
    { label: "Avg Position", value: "7.2", tone: "cyan" },
    { label: "Backlinks", value: "3,240", tone: "green" },
    { label: "Domain Authority", value: "58", tone: "amber" },
  ];

  return (
    <>
      <PageHeader
        title="Global SEO Tools"
        description="Keyword research, rank tracking, competitor analysis, and site optimization"
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
              icon={[<Search className="h-4 w-4" />, <TrendingUp className="h-4 w-4" />, <LinkIcon className="h-4 w-4" />, <Target className="h-4 w-4" />][i]}
            />
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="keywords" className="space-y-4">
          <TabsList>
            <TabsTrigger value="keywords">
              <Search className="mr-2 h-4 w-4" /> Keywords
            </TabsTrigger>
            <TabsTrigger value="ranking">
              <TrendingUp className="mr-2 h-4 w-4" /> Rank Tracking
            </TabsTrigger>
            <TabsTrigger value="competitors">
              <Target className="mr-2 h-4 w-4" /> Competitors
            </TabsTrigger>
            <TabsTrigger value="backlinks">
              <LinkIcon className="mr-2 h-4 w-4" /> Backlinks
            </TabsTrigger>
            <TabsTrigger value="audit">
              <FileText className="mr-2 h-4 w-4" /> Site Audit
            </TabsTrigger>
            <TabsTrigger value="local">
              <MapIcon className="mr-2 h-4 w-4" /> Local SEO
            </TabsTrigger>
          </TabsList>

          {/* Keywords Tab */}
          <TabsContent value="keywords">
            <GlassCard title="Keyword Research & Tracking">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Add new keyword..." className="flex-1" />
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Keyword
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Difficulty</TableHead>
                        <TableHead className="text-right">Rank</TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keywords.map((kw) => (
                        <TableRow key={kw.id}>
                          <TableCell className="font-medium">{kw.keyword}</TableCell>
                          <TableCell className="text-right">{kw.volume.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                kw.difficulty < 30
                                  ? "border-status-success/40 bg-status-success/15 text-status-success"
                                  : kw.difficulty < 50
                                    ? "border-status-warning/40 bg-status-warning/15 text-status-warning"
                                    : "border-status-error/40 bg-status-error/15 text-status-error"
                              }
                            >
                              {kw.difficulty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-primary"># {kw.rank}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {kw.trend === "up" ? (
                              <TrendingUp className="h-4 w-4 text-status-success inline" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-status-error inline rotate-180" />
                            )}
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

          {/* Rank Tracking Tab */}
          <TabsContent value="ranking">
            <GlassCard title="SERP Rank Tracking">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Avg Rank Position</p>
                    <p className="text-2xl font-bold text-primary">7.2</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Keywords in Top 10</p>
                    <p className="text-2xl font-bold text-status-success">42</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Rankings Improved</p>
                    <p className="text-2xl font-bold text-status-success">+18</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Competitors Tab */}
          <TabsContent value="competitors">
            <GlassCard title="Competitor Analysis">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competitor</TableHead>
                      <TableHead className="text-right">Domain Score</TableHead>
                      <TableHead className="text-right">Backlinks</TableHead>
                      <TableHead className="text-right">Keywords</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitors.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell className="font-medium">{comp.name}</TableCell>
                        <TableCell className="text-right">{comp.score}</TableCell>
                        <TableCell className="text-right">{comp.backlinks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{comp.keywords.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <button className="text-primary hover:underline flex items-center gap-1">
                            Analyze <ExternalLink className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Backlinks Tab */}
          <TabsContent value="backlinks">
            <GlassCard title="Backlink Monitor">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Total Backlinks</p>
                    <p className="text-2xl font-bold text-primary">3,240</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">New Backlinks (30d)</p>
                    <p className="text-2xl font-bold text-status-success">+145</p>
                  </div>
                  <div className="rounded-lg bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Lost Backlinks</p>
                    <p className="text-2xl font-bold text-status-error">-12</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Site Audit Tab */}
          <TabsContent value="audit">
            <GlassCard title="Site Audit">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-4">
                    <p className="text-sm font-medium text-status-error">⚠ Critical Issues: 4</p>
                  </div>
                  <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-4">
                    <p className="text-sm font-medium text-status-warning">⚠ Warnings: 12</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Local SEO Tab */}
          <TabsContent value="local">
            <GlassCard title="Local SEO Management">
              <div className="space-y-4">
                <Button className="w-full">
                  <MapIcon className="mr-2 h-4 w-4" /> Manage Google Business Listing
                </Button>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
