import { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, FileText, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useTickets, relativeTime } from "@/hooks/useSalesSupportData";

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const SLAComplianceModule = () => {
  const { data: ticketsData, isLoading } = useTickets();
  const tickets = ticketsData ?? [];

  const rules = useMemo(() => {
    return PRIORITIES.map((priority) => {
      const group = tickets.filter(t => t.priority === priority);
      const total = group.length;
      const breaches = group.filter(t => t.sla_breached).length;
      const compliance = total ? Math.round(((total - breaches) / total) * 100) : 100;
      return { priority, total, breaches, compliance };
    });
  }, [tickets]);

  const atRisk = useMemo(
    () => tickets
      .filter(t => t.status !== "resolved" && t.status !== "closed" && !t.sla_breached && t.sla_minutes_remaining < 60)
      .sort((a, b) => a.sla_minutes_remaining - b.sla_minutes_remaining),
    [tickets],
  );

  const breached = useMemo(() => tickets.filter(t => t.sla_breached), [tickets]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500/20 text-red-300";
      case "high": return "bg-amber-500/20 text-amber-300";
      case "medium": return "bg-blue-500/20 text-blue-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const getComplianceColor = (compliance: number) => {
    if (compliance >= 95) return "text-emerald-400";
    if (compliance >= 85) return "text-amber-400";
    return "text-red-400";
  };

  const overallCompliance = tickets.length
    ? Math.round(((tickets.length - breached.length) / tickets.length) * 100)
    : 100;
  const totalBreaches = breached.length;

  const handleGenerateReport = () => {
    toast.loading("Generating compliance report...", { id: "report" });
    const content = `SLA Compliance Report\nGenerated: ${new Date().toLocaleString()}\n\nBy Priority:\n${rules.map(r => `${r.priority}: ${r.compliance}% compliance (${r.breaches}/${r.total} breached)`).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SLA_Compliance_Report.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Report generated", { id: "report", description: "SLA_Compliance_Report.txt downloaded" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">SLA & Compliance</h2>
          <p className="text-muted-foreground">Live SLA compliance derived from ticket data</p>
        </div>
        <Button onClick={handleGenerateReport} className="bg-cyan-500 hover:bg-cyan-600 text-foreground">
          <FileText className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className={`text-2xl font-bold ${getComplianceColor(overallCompliance)}`}>{overallCompliance}%</div>
            <div className="text-xs text-muted-foreground">Overall Compliance</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Shield className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{atRisk.length}</div>
            <div className="text-xs text-muted-foreground">At-Risk Tickets</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{totalBreaches}</div>
            <div className="text-xs text-muted-foreground">Total Breaches</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{tickets.length}</div>
            <div className="text-xs text-muted-foreground">Total Tickets Tracked</div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Rules List (derived per priority) */}
      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">SLA Compliance by Priority</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading && <p className="text-muted-foreground text-sm">Loading tickets…</p>}
            {!isLoading && rules.map((rule, index) => (
              <motion.div
                key={rule.priority}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground capitalize">{rule.priority} Priority</span>
                    <Badge className={getPriorityColor(rule.priority)}>{rule.priority}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Compliance</span>
                    <div className={`font-medium ${getComplianceColor(rule.compliance)}`}>{rule.compliance}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Breaches / Total</span>
                    <div className="text-muted-foreground">{rule.breaches} / {rule.total}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <Progress value={rule.compliance} className="h-2" />
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* At-Risk Tickets */}
      <Card className="bg-card/60 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">At-Risk Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {atRisk.length === 0 && <p className="text-muted-foreground text-sm">No tickets currently at risk.</p>}
            {atRisk.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-card/60 rounded-lg text-sm">
                <div>
                  <span className="font-mono text-cyan-400">{t.reference}</span>
                  <span className="text-muted-foreground ml-2">{t.subject}</span>
                  <span className="text-muted-foreground ml-2">• {t.customer_name}</span>
                </div>
                <Badge className="bg-red-500/20 text-red-300">{t.sla_minutes_remaining} min left</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compliance Warning */}
      {totalBreaches > 0 && (
        <Card className="bg-gradient-to-r from-red-900/30 to-amber-900/30 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="font-medium text-red-100">SLA Breach Alert</h3>
                <p className="text-sm text-muted-foreground">{totalBreaches} SLA breaches detected. Review critical tickets immediately.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SLAComplianceModule;
