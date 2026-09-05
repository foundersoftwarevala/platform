import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthCheckResult {
  id: string;
  url: string;
  status: "healthy" | "unhealthy" | "error";
  http_status: number | null;
  response_time_ms: number | null;
  error?: string;
}

interface HealthCheckSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  error: number;
}

interface HealthCheckResponse {
  message: string;
  summary: HealthCheckSummary;
  results: HealthCheckResult[];
}

export const useHealthCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [summary, setSummary] = useState<HealthCheckSummary | null>(null);

  const runHealthCheck = async (demoIds?: string[], batchSize: number = 50) => {
    setIsChecking(true);
    setProgress(0);
    setResults([]);
    setSummary(null);

    try {
      // Get all demo IDs if not provided
      let idsToCheck = demoIds;
      
      if (!idsToCheck || idsToCheck.length === 0) {
        const { data: demos, error } = await supabase
          .from("demos")
          .select("id")
          .eq("status", "active");
        
        if (error) throw error;
        idsToCheck = demos?.map(d => d.id) || [];
      }

      const totalDemos = idsToCheck.length;
      const batches = Math.ceil(totalDemos / batchSize);
      setTotalBatches(batches);

      let allResults: HealthCheckResult[] = [];
      let overallSummary: HealthCheckSummary = { total: 0, healthy: 0, unhealthy: 0, error: 0 };

      for (let i = 0; i < batches; i++) {
        setCurrentBatch(i + 1);
        const batchIds = idsToCheck.slice(i * batchSize, (i + 1) * batchSize);

        const { data, error } = await supabase.functions.invoke("health-check", {
          body: { demo_ids: batchIds, batch_size: batchSize },
        });

        if (error) {
          console.error("Batch error:", error);
          toast.error(`Batch ${i + 1} failed: ${error.message}`);
          continue;
        }

        const response = data as HealthCheckResponse;
        allResults = [...allResults, ...response.results];
        
        overallSummary.total += response.summary.total;
        overallSummary.healthy += response.summary.healthy;
        overallSummary.unhealthy += response.summary.unhealthy;
        overallSummary.error += response.summary.error;

        setProgress(Math.round(((i + 1) / batches) * 100));
        setResults(allResults);
        setSummary(overallSummary);

        // Small delay between batches to avoid rate limiting
        if (i < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      toast.success(`Health check completed! ${overallSummary.healthy}/${overallSummary.total} healthy`);
      return { results: allResults, summary: overallSummary };
    } catch (error: any) {
      console.error("Health check error:", error);
      toast.error(`Health check failed: ${error.message}`);
      throw error;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isChecking,
    progress,
    totalBatches,
    currentBatch,
    results,
    summary,
    runHealthCheck,
  };
};
