import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, AlertTriangle, Bell } from "lucide-react";

import { useLegalAlerts, useLegalRecords } from "@/lib/legal-data";

const LegalOverview = () => {
  const { data: regions = [] } = useLegalRecords("regional_compliance");
  const { data: requests = [] } = useLegalRecords("legal_request");
  const { data: incidents = [] } = useLegalRecords("incident");
  const { data: compliance = [] } = useLegalRecords("compliance_gdpr");
  const { data: kyc = [] } = useLegalRecords("compliance_kyc");
  const { data: dataProtection = [] } = useLegalRecords("compliance_dp");
  const { data: alerts = [] } = useLegalAlerts();

  const allChecks = [...compliance, ...kyc, ...dataProtection];
  const compliantCount = allChecks.filter((c) => c.status === "compliant").length;
  const healthScore = allChecks.length
    ? Math.round((compliantCount / allChecks.length) * 100)
    : 0;
  const openRequests = requests.filter(
    (r) => r.status !== "resolved" && r.status !== "closed",
  );
  const highPriority = openRequests.filter(
    (r) => r.priority === "high" || r.priority === "critical",
  ).length;
  const activeDisputes = incidents.filter((i) => i.status !== "resolved");
  const pendingDisputes = activeDisputes.filter((i) => i.status === "pending_action").length;
  const pendingAlerts = alerts.filter((a) => a.status === "pending");
  const nonCompliantRegions = regions.filter((r) => r.status !== "Compliant").length;

  const stats = [
    {
      label: "Compliance Health Score",
      value: `${healthScore}/100`,
      icon: Shield,
      trend: nonCompliantRegions === 0 ? "All regions compliant" : `${nonCompliantRegions} region(s) under review`,
      color: "text-emerald-400",
    },
    {
      label: "Open Legal Requests",
      value: String(openRequests.length),
      icon: FileText,
      trend: `${highPriority} high priority`,
      color: "text-amber-400",
    },
    {
      label: "Active Disputes",
      value: String(activeDisputes.length),
      icon: AlertTriangle,
      trend: `${pendingDisputes} pending resolution`,
      color: "text-red-400",
    },
    {
      label: "Policy Update Alerts",
      value: String(pendingAlerts.length),
      icon: Bell,
      trend: pendingAlerts[0]?.title ?? "No pending alerts",
      color: "text-blue-400",
    },
  ];

  const formatAge = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.round(diff / 3_600_000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-card/50 border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-amber-400">Regional Compliance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regions.map((item) => (
                <div key={item.id} className="flex justify-between p-3 bg-surface/50 rounded">
                  <span className="text-foreground">{item.name}</span>
                  <span
                    className={
                      item.status === "Compliant" ? "text-emerald-400" : "text-yellow-400"
                    }
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-amber-400">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 4).map((item) => (
                <div key={item.id} className="flex justify-between p-3 bg-surface/50 rounded">
                  <span className="text-primary-foreground text-sm">{item.title}</span>
                  <span className="text-muted-foreground text-xs">{formatAge(item.detected_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default LegalOverview;
