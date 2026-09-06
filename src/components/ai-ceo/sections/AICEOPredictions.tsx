import { motion } from "framer-motion";
import { PageBanner, PageShell, SeedNotice } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertTriangle,
  DollarSign,
  Users,
  Server,
  Zap
} from "lucide-react";

// Mock prediction data
const predictions = [
  {
    id: 1,
    title: "Revenue Growth Expected",
    type: "positive",
    timeline: "Next 7 days",
    confidence: 89,
    detail: "Based on current lead pipeline and conversion rates, expect 15% revenue increase",
    icon: DollarSign
  },
  {
    id: 2,
    title: "System Overload Risk",
    type: "warning",
    timeline: "Next 30 days",
    confidence: 72,
    detail: "Traffic patterns suggest server capacity may reach 85% during peak hours",
    icon: Server
  },
  {
    id: 3,
    title: "Staff Burnout Detected",
    type: "negative",
    timeline: "Next quarter",
    confidence: 68,
    detail: "Support team overtime hours trending 40% above healthy threshold",
    icon: Users
  },
  {
    id: 4,
    title: "High-Risk Deal Identified",
    type: "warning",
    timeline: "Next 7 days",
    confidence: 81,
    detail: "Client #456 showing payment delay patterns similar to past defaults",
    icon: AlertTriangle
  },
  {
    id: 5,
    title: "Feature Adoption Surge",
    type: "positive",
    timeline: "Next 30 days",
    confidence: 85,
    detail: "New reporting module adoption trending 3x higher than projected",
    icon: Zap
  },
];

const timelineData = {
  sevenDays: [
    { label: "Revenue", prediction: "+12%", confidence: 89 },
    { label: "New Leads", prediction: "+45", confidence: 78 },
    { label: "Support Load", prediction: "Normal", confidence: 92 },
  ],
  thirtyDays: [
    { label: "Churn Risk", prediction: "2 clients", confidence: 71 },
    { label: "Expansion", prediction: "3 regions", confidence: 65 },
    { label: "Hiring Need", prediction: "+5 support", confidence: 82 },
  ],
  quarter: [
    { label: "Market Share", prediction: "+2.3%", confidence: 58 },
    { label: "Infrastructure", prediction: "Upgrade needed", confidence: 76 },
    { label: "Compliance", prediction: "Audit due", confidence: 95 },
  ],
};

const getTypeStyle = (type: string) => {
  switch (type) {
    case 'positive': return { bg: 'bg-accent-emerald/20', text: 'text-accent-emerald', border: 'border-accent-emerald/30' };
    case 'negative': return { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive/30' };
    case 'warning': return { bg: 'bg-accent-amber/20', text: 'text-accent-amber', border: 'border-accent-amber/30' };
    default: return { bg: 'bg-primary/20', text: 'text-primary-glow', border: 'border-primary/30' };
  }
};

const AICEOPredictions = () => {
  return (
    <PageShell>
      <PageBanner
        icon={Lightbulb}
        title="Predictive Insights"
        subtitle="Forward-looking forecasts, opportunity detection and risk projections from the AI models."
        status="Forecast horizon · 90 days"
      />

      <SeedNotice waitingFor="a forecasting model — no prediction engine is connected" />

      {/* Timeline Predictions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {Object.entries(timelineData).map(([key, items], i) => {
          const titles = { sevenDays: "Next 7 Days", thirtyDays: "Next 30 Days", quarter: "Next Quarter" };
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="card3d premium-halo enter-soft rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-glow" />
                    {titles[key as keyof typeof titles]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.prediction}</span>
                        <Badge variant="outline" className="text-xs">{item.confidence}%</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Predictions */}
      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-accent-amber" />
            Active Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {predictions.map((prediction, i) => {
                const style = getTypeStyle(prediction.type);
                return (
                  <motion.div
                    key={prediction.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-5 rounded-xl bg-surface border ${style.border} hover:shadow-lg transition-all`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center`}>
                          <prediction.icon className={`w-6 h-6 ${style.text}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{prediction.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{prediction.timeline}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${style.bg} ${style.text}`}>
                        {prediction.type === 'positive' ? <TrendingUp className="w-3 h-3 mr-1" /> : 
                         prediction.type === 'negative' ? <TrendingDown className="w-3 h-3 mr-1" /> :
                         <AlertTriangle className="w-3 h-3 mr-1" />}
                        {prediction.type}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">{prediction.detail}</p>

                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">AI Confidence:</span>
                      <Progress value={prediction.confidence} className="h-1.5 flex-1" />
                      <span className={`text-sm font-medium ${style.text}`}>{prediction.confidence}%</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* AI Notice */}
      <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-accent-amber" />
          <p className="text-sm text-accent-amber/80">
            <strong>Predictive Notice:</strong> These are AI-generated forecasts based on historical patterns. Actual outcomes may vary.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOPredictions;
