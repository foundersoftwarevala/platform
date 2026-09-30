import { motion } from "framer-motion";
import { PageBanner, PageShell } from "@/components/ai-ceo/PageShell";
import { useCEOOps } from "@/hooks/useCEOOps";

/**
 * Predictions, from the one prediction source the platform has.
 *
 * Five predictions ("Revenue Growth Expected", 89% confidence, "Client #456"
 * and so on) and nine 7-day/30-day/quarter forecasts were written into this
 * file. None came from anywhere. The platform's only forward-looking records
 * are the Promise Tracker's AI insights (promise_ai_insights): for each
 * delivery promise, the probability it will be missed and what to do about
 * it. Those are the predictions listed here, read through the same
 * loadCeoOps() the Insights screen uses.
 *
 * Revenue, lead, support-load, churn and market forecasts have no model and no
 * table behind them, so those three panels say so and show no figure.
 */
const FORECAST_PANELS = [
  { key: "sevenDays", title: "Next 7 Days" },
  { key: "thirtyDays", title: "Next 30 Days" },
  { key: "quarter", title: "Next Quarter" },
] as const;

/** A promise's delay risk, in this screen's positive / warning / negative. */
const typeOf = (risk: string) =>
  /critical|high|severe/i.test(risk) ? "negative" : /low|none|on[_ ]?track/i.test(risk) ? "positive" : "warning";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertTriangle
} from "lucide-react";

const getTypeStyle = (type: string) => {
  switch (type) {
    case 'positive': return { bg: 'bg-accent-emerald/20', text: 'text-accent-emerald', border: 'border-accent-emerald/30' };
    case 'negative': return { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive/30' };
    case 'warning': return { bg: 'bg-accent-amber/20', text: 'text-accent-amber', border: 'border-accent-amber/30' };
    default: return { bg: 'bg-primary/20', text: 'text-primary-glow', border: 'border-primary/30' };
  }
};

const AICEOPredictions = () => {
  const { insights, isLoading, failed, degraded } = useCEOOps();
  const promiseFailed = failed || degraded.includes("promise_ai_insights");
  const predictions = insights
    .filter((i) => i.source === "promise_ai_insights")
    .map((i) => ({
      id: i.id,
      title: i.title,
      type: typeOf(i.severity),
      timeline: i.createdAt ? `Predicted ${new Date(i.createdAt).toLocaleDateString()}` : "Prediction date not recorded",
      confidence: i.confidence,
      detail: [i.detail, i.recommendation && `Suggested: ${i.recommendation}`].filter(Boolean).join(" "),
      icon: AlertTriangle,
    }));
  return (
    <PageShell>
      <PageBanner
        icon={Lightbulb}
        title="Predictive Insights"
        subtitle="Forward-looking forecasts, opportunity detection and risk projections from the AI models."
        status="Delivery-promise predictions"
      />

      {/* Timeline Predictions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {FORECAST_PANELS.map(({ key, title }, i) => {
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
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    No forecasting model is connected, so no revenue, lead, load or growth forecast is shown.
                  </p>
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
              {(isLoading || promiseFailed || predictions.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading predictions…"
                    : promiseFailed
                      ? "The Promise Tracker's predictions could not be read."
                      : "No prediction yet. They appear when the Promise Tracker's AI assesses a delivery promise."}
                </p>
              )}
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
                      <Progress value={prediction.confidence ?? 0} className="h-1.5 flex-1" />
                      <span className={`text-sm font-medium ${style.text}`}>
                        {prediction.confidence == null ? "—" : `${prediction.confidence}%`}
                      </span>
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
            <strong>Predictive Notice:</strong> These are AI assessments of whether delivery promises will be missed. Actual outcomes may vary.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default AICEOPredictions;
