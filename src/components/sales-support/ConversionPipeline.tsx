import { motion } from "framer-motion";
import { GitBranch, User, Clock, DollarSign, ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLeads, useDeals, relativeTime, currency } from "@/hooks/useSalesSupportData";

const STAGE_DEFS = [
  { key: "new", name: "New Leads", color: "cyan" },
  { key: "contact", name: "Contacted", color: "blue" },
  { key: "demo", name: "Demo Sent", color: "purple" },
  { key: "negotiat", name: "Negotiation", color: "amber" },
  { key: "closed_won", name: "Closed Won", color: "emerald" },
] as const;

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    cyan: { bg: "bg-cyan-500/20", border: "border-cyan-500/30", text: "text-cyan-400", badge: "bg-cyan-500" },
    blue: { bg: "bg-blue-500/20", border: "border-blue-500/30", text: "text-blue-400", badge: "bg-blue-500" },
    purple: { bg: "bg-purple-500/20", border: "border-purple-500/30", text: "text-purple-400", badge: "bg-purple-500" },
    amber: { bg: "bg-amber-500/20", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500" },
    emerald: { bg: "bg-emerald-500/20", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500" },
  };
  return colors[color] || colors.cyan;
};

const ConversionPipeline = () => {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const loading = leadsLoading || dealsLoading;

  const stages = STAGE_DEFS.map((def) => {
    const stageLeads =
      def.key === "closed_won"
        ? leads.filter((l) => l.stage?.toLowerCase().includes("closed") && l.stage?.toLowerCase().includes("won"))
        : leads.filter((l) => l.stage?.toLowerCase().replace(/[_\s-]/g, "").includes(def.key.replace(/[_\s-]/g, "")));
    const totalValue = stageLeads.reduce((sum, l) => sum + Number(l.value ?? 0), 0);
    return {
      ...def,
      count: stageLeads.length,
      value: currency(totalValue),
      leads: stageLeads.slice(0, 3).map((l) => ({
        name: l.company,
        value: currency(l.value),
        time: relativeTime(l.created_at),
      })),
    };
  });

  const totalPipelineValue = leads.reduce((sum, l) => sum + Number(l.value ?? 0), 0);
  const totalInPipeline = leads.length;
  const closedWon = stages.find((s) => s.key === "closed_won")?.count ?? 0;
  const conversionRate = totalInPipeline > 0 ? Math.round((closedWon / totalInPipeline) * 100) : 0;
  const closedDeals = deals.filter((d) => d.stage?.toLowerCase().includes("closed"));
  const avgCycleDays =
    closedDeals.length > 0
      ? Math.round(
          closedDeals.reduce((sum, d) => {
            const start = new Date(d.created_at).getTime();
            const end = new Date(d.updated_at).getTime();
            return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
          }, 0) / closedDeals.length,
        )
      : 0;
  const allValues = [...leads.map((l) => Number(l.value ?? 0)), ...deals.map((d) => Number(d.value ?? 0))];
  const avgDealSize = allValues.length > 0 ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading pipeline…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Conversion Pipeline</h2>
          <p className="text-muted-foreground">Visual sales funnel with drag-and-drop stages</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-cyan-100">{currency(totalPipelineValue)}</div>
            <div className="text-xs text-muted-foreground">Total Pipeline Value</div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5">
            <TrendingUp className="w-4 h-4 mr-1" />
            {conversionRate}% Conversion Rate
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stages.map((stage, stageIndex) => {
          const colorClasses = getColorClasses(stage.color);
          return (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: stageIndex * 0.1 }}
            >
              <Card className={`bg-card/60 ${colorClasses.border} h-full`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm ${colorClasses.text}`}>{stage.name}</CardTitle>
                    <Badge className={`${colorClasses.badge} text-foreground`}>{stage.count}</Badge>
                  </div>
                  <div className="text-lg font-bold text-foreground">{stage.value}</div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stage.leads.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">No leads in this stage</div>
                  )}
                  {stage.leads.map((lead, leadIndex) => (
                    <motion.div
                      key={lead.name + leadIndex}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: stageIndex * 0.1 + leadIndex * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      className={`p-3 rounded-lg ${colorClasses.bg} cursor-grab active:cursor-grabbing`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <User className={`w-3 h-3 ${colorClasses.text}`} />
                        <span className="text-sm font-medium text-foreground">{lead.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={colorClasses.text}>
                          <DollarSign className="w-3 h-3 inline" />
                          {lead.value}
                        </span>
                        <span className="text-muted-foreground">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {lead.time}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {stageIndex < stages.length - 1 && (
                    <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-cyan-400" />
              <div>
                <div className="text-2xl font-bold text-cyan-100">{totalInPipeline}</div>
                <div className="text-xs text-muted-foreground">Total in Pipeline</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
              <div>
                <div className="text-2xl font-bold text-emerald-100">{conversionRate}%</div>
                <div className="text-xs text-muted-foreground">Conversion Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-400" />
              <div>
                <div className="text-2xl font-bold text-amber-100">{avgCycleDays} days</div>
                <div className="text-xs text-muted-foreground">Avg. Sales Cycle</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-purple-100">{currency(avgDealSize)}</div>
                <div className="text-xs text-muted-foreground">Avg. Deal Size</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConversionPipeline;
