import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useFounderInsights } from "@/hooks/useFounderInsights";
import { PageBanner, PageShell } from "@/components/ai-ceo/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Lightbulb, RefreshCw } from "lucide-react";

const FORECAST_PANELS = [
  { period: "7d", title: "Next 7 Days" },
  { period: "30d", title: "Next 30 Days" },
  { period: "90d", title: "Next Quarter" },
] as const;

function formatRevenue(entries: { currency: string; amount: number }[]): string {
  if (entries.length === 0) return "No paid revenue recorded";
  return entries.map(({ currency, amount }) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }).join(" · ");
}

function predictionTone(risk: string) {
  if (risk === "HIGH") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (risk === "MEDIUM") return "border-accent-amber/30 bg-accent-amber/10 text-accent-amber";
  return "border-primary/30 bg-primary/10 text-primary-glow";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "The VPS insight request failed.";
}

const AICEOPredictions = () => {
  const {
    forecast,
    forecastLoading,
    forecastFailed,
    forecastError,
    refreshForecast,
    refreshingForecast,
    retryForecast,
    promisePredictions,
    promisePredictionsLoading,
    promisePredictionsFailed,
    retryPromisePredictions,
  } = useFounderInsights();
  const forecastErrorMessage = forecastError ? messageOf(forecastError) : null;
  const initialForecastStarted = useRef(false);

  useEffect(() => {
    if (!forecastLoading && !forecastFailed && !forecast && !refreshingForecast && !initialForecastStarted.current) {
      initialForecastStarted.current = true;
      refreshForecast();
    }
  }, [forecast, forecastFailed, forecastLoading, refreshForecast, refreshingForecast]);

  return (
    <PageShell>
      <PageBanner
        icon={Lightbulb}
        title="Predictive Insights"
        subtitle="Cautious forecasts from recent VPS order, lead and support records, assessed by local Ollama."
        status={forecast?.model ?? "Local AI · VPS data"}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {forecast
            ? `Calculated ${new Date(forecast.generatedAt).toLocaleString()} · ${forecast.history.weeks} weekly buckets · ${forecast.history.paidOrders} paid orders`
            : "No forecast is saved for the current VPS data snapshot yet."}
        </p>
        <Button onClick={() => void refreshForecast()} disabled={refreshingForecast || forecastLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshingForecast ? "animate-spin" : ""}`} />
          {refreshingForecast ? "Forecasting…" : "Refresh Predictions"}
        </Button>
      </div>

      {forecastErrorMessage && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Forecast request failed: {forecastErrorMessage}
        </div>
      )}
      {forecastFailed && !forecastErrorMessage && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Could not read the saved forecast from VPS Postgres.
          <Button size="sm" variant="link" onClick={() => void retryForecast()}>Try again</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {FORECAST_PANELS.map(({ period, title }, index) => {
          const estimate = forecast?.periods.find((item) => item.period === period);
          return (
            <motion.div key={period} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="card3d premium-halo enter-soft rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                    <Clock className="h-4 w-4 text-primary-glow" />{title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {forecastLoading || refreshingForecast ? (
                    <p className="text-xs text-muted-foreground">Reading VPS history and generating forecast…</p>
                  ) : estimate ? (
                    <>
                      <div><p className="text-xs text-muted-foreground">Paid revenue · by recorded currency</p><p className="font-semibold text-foreground">{formatRevenue(estimate.revenueByCurrency)}</p></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-xs text-muted-foreground">New leads</p><p className="text-lg font-semibold text-foreground">{estimate.leads.toLocaleString()}</p></div>
                        <div><p className="text-xs text-muted-foreground">New support tickets</p><p className="text-lg font-semibold text-foreground">{estimate.supportTickets.toLocaleString()}</p></div>
                      </div>
                      <div><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Model confidence</span><span>{estimate.confidence}%</span></div><Progress value={estimate.confidence} className="h-1.5" /></div>
                      <p className="text-xs text-muted-foreground">{estimate.rationale}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {forecastErrorMessage ? "No current forecast is available; see the error above." : "Use Refresh Predictions to run the local model against current VPS history."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {forecast && (
        <p className="text-xs text-muted-foreground">
          History: {forecast.history.leads} leads, {forecast.history.supportTickets} created tickets, {forecast.history.openSupportTickets} currently open tickets.
          {forecast.limitations ? ` Model limitation: ${forecast.limitations}` : ""}
        </p>
      )}

      <Card className="card3d premium-halo hover-lift shimmer-sweep enter-soft rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground"><Lightbulb className="h-5 w-5 text-accent-amber" />Active Promise Risk Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {promisePredictionsLoading && <p className="text-sm text-muted-foreground">Loading VPS promise-risk assessments…</p>}
              {promisePredictionsFailed && (
                <p role="alert" className="text-sm text-destructive">
                  Promise risk records could not be read from VPS Postgres. <Button size="sm" variant="link" onClick={() => void retryPromisePredictions()}>Try again</Button>
                </p>
              )}
              {!promisePredictionsLoading && !promisePredictionsFailed && promisePredictions.length === 0 && (
                <p className="text-sm text-muted-foreground">No promise has been flagged by a local risk assessment yet. New promises are assessed after creation when local Ollama is available.</p>
              )}
              {promisePredictions.map((prediction, index) => (
                <motion.div key={prediction.promiseId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className={`rounded-xl border p-4 ${predictionTone(prediction.risk)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <h3 className="font-medium text-foreground">{prediction.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Deadline {new Date(prediction.deadline).toLocaleDateString()} · assessed {new Date(prediction.createdAt).toLocaleString()} · {prediction.model}</p>
                      </div>
                    </div>
                    <Badge className={predictionTone(prediction.risk)}>{prediction.risk}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-foreground">{prediction.rationale}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Suggested: {prediction.recommendation}</p>
                  <div className="mt-3 flex items-center gap-3"><span className="text-xs text-muted-foreground">AI confidence</span><Progress value={prediction.confidence} className="h-1.5 flex-1" /><span className="text-sm font-medium">{prediction.confidence}%</span></div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-4">
        <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-accent-amber" /><p className="text-sm text-accent-amber/80"><strong>Forecasts are estimates.</strong> They use recorded VPS history and local Ollama; they do not include external market data.</p></div>
      </div>
    </PageShell>
  );
};

export default AICEOPredictions;
