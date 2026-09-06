import { motion } from "framer-motion";
import { PageBanner, PageShell, SeedNotice } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Shield, 
  Lock,
  FileWarning,
  DollarSign,
  Clock,
  CheckCircle
} from "lucide-react";

// Mock risk data
const riskCategories = [
  { 
    id: 1, 
    category: "Security Risk", 
    level: "medium",
    score: 45,
    issues: 3,
    trend: "stable",
    icon: Shield
  },
  { 
    id: 2, 
    category: "Legal Risk", 
    level: "low",
    score: 18,
    issues: 1,
    trend: "improving",
    icon: FileWarning
  },
  { 
    id: 3, 
    category: "Financial Exposure", 
    level: "high",
    score: 72,
    issues: 5,
    trend: "worsening",
    icon: DollarSign
  },
  { 
    id: 4, 
    category: "SLA Breach", 
    level: "low",
    score: 12,
    issues: 0,
    trend: "stable",
    icon: Clock
  },
  { 
    id: 5, 
    category: "Policy Violation", 
    level: "medium",
    score: 38,
    issues: 2,
    trend: "improving",
    icon: Lock
  },
];

const complianceItems = [
  { id: 1, policy: "Data Protection (GDPR)", status: "compliant", lastAudit: "2 days ago" },
  { id: 2, policy: "Financial Regulations", status: "warning", lastAudit: "1 week ago" },
  { id: 3, policy: "User Privacy Policy", status: "compliant", lastAudit: "3 days ago" },
  { id: 4, policy: "Access Control Policy", status: "compliant", lastAudit: "Today" },
  { id: 5, policy: "Incident Response Plan", status: "review", lastAudit: "2 weeks ago" },
];

const preventiveSuggestions = [
  "Implement additional MFA for high-value transactions",
  "Review franchise payment thresholds - potential over-limit patterns detected",
  "Schedule security audit for APAC region servers",
];

const getLevelStyle = (level: string) => {
  switch (level) {
    case 'high': return { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive/30' };
    case 'medium': return { bg: 'bg-accent-amber/20', text: 'text-accent-amber', border: 'border-accent-amber/30' };
    case 'critical': return { bg: 'bg-destructive/30', text: 'text-destructive', border: 'border-destructive/50' };
    default: return { bg: 'bg-accent-emerald/20', text: 'text-accent-emerald', border: 'border-accent-emerald/30' };
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'compliant': return 'bg-accent-emerald/20 text-accent-emerald';
    case 'warning': return 'bg-accent-amber/20 text-accent-amber';
    case 'review': return 'bg-primary/20 text-primary-glow';
    default: return 'bg-destructive/20 text-destructive';
  }
};

const AICEORiskCompliance = () => {
  return (
    <PageShell>
      <PageBanner
        icon={ShieldAlert}
        title="Risk & Compliance"
        subtitle="Fraud detection, anomaly flagging and compliance posture across the ecosystem."
        status="Monitoring 24/7"
      />

      <SeedNotice waitingFor="a risk scoring engine and a compliance register" />

      {/* Risk Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {riskCategories.map((risk, i) => {
          const style = getLevelStyle(risk.level);
          return (
            <motion.div
              key={risk.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`bg-card ${style.border} backdrop-blur-xl`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <risk.icon className={`w-5 h-5 ${style.text}`} />
                    <Badge className={`${style.bg} ${style.text} text-xs`}>
                      {risk.level}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground font-medium mb-2">{risk.category}</p>
                  <div className="space-y-2">
                    <Progress value={risk.score} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{risk.issues} issues</span>
                      <span className={style.text}>{risk.score}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Compliance Status */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent-emerald" />
              Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {complianceItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.policy}</p>
                      <p className="text-xs text-muted-foreground">Last audit: {item.lastAudit}</p>
                    </div>
                    <Badge className={getStatusStyle(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Preventive Suggestions */}
        <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-accent-amber" />
              AI Preventive Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {preventiveSuggestions.map((suggestion, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-accent-amber flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{suggestion}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-accent-amber" />
          <p className="text-sm text-accent-amber/80">
            <strong>Risk Monitoring:</strong> AI continuously monitors all risk vectors. Critical issues are escalated to Boss immediately.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEORiskCompliance;
