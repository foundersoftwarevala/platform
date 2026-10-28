import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  loadFounderForecast,
  loadPromiseRiskPredictions,
  refreshFounderForecast,
} from "@/lib/founder/decision.functions";
import type { ForecastView, PromiseRiskPrediction } from "@/lib/founder/insights.server";

const FORECAST_KEY = ["founder", "operational-forecast"] as const;
const PROMISE_RISK_KEY = ["founder", "promise-risk-predictions"] as const;

export function useFounderInsights() {
  const queryClient = useQueryClient();
  const fetchForecast = useServerFn(loadFounderForecast);
  const runForecast = useServerFn(refreshFounderForecast);
  const fetchPromiseRisks = useServerFn(loadPromiseRiskPredictions);

  const forecastQuery = useQuery({
    queryKey: FORECAST_KEY,
    queryFn: () => fetchForecast(),
    staleTime: 30_000,
  });
  const promiseQuery = useQuery({
    queryKey: PROMISE_RISK_KEY,
    queryFn: () => fetchPromiseRisks(),
    staleTime: 15_000,
  });
  const forecastMutation = useMutation({
    mutationFn: () => runForecast(),
    onSuccess: (forecast) => queryClient.setQueryData(FORECAST_KEY, forecast),
  });

  return {
    forecast: (forecastQuery.data as ForecastView | null | undefined) ?? null,
    forecastLoading: forecastQuery.isLoading,
    forecastFailed: forecastQuery.isError,
    forecastError: forecastMutation.error ?? forecastQuery.error,
    refreshForecast: forecastMutation.mutate,
    refreshingForecast: forecastMutation.isPending,
    retryForecast: forecastQuery.refetch,
    promisePredictions: (promiseQuery.data as PromiseRiskPrediction[] | undefined) ?? [],
    promisePredictionsLoading: promiseQuery.isLoading,
    promisePredictionsFailed: promiseQuery.isError,
    retryPromisePredictions: promiseQuery.refetch,
  };
}
