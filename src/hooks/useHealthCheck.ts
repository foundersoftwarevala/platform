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
      /**
       * Every live demo, from the table the storefront serves.
       *
       * With no ids this read the legacy `demos` table through the browser
       * Supabase client - the hosted project - and asked a hosted edge function
       * to check those. The demos visitors open are product_demo_urls on the
       * VPS, so the panel checked a list nobody uses and stored nothing where
       * the studio reads it. It now checks the real addresses with the Demo
       * Manager's own check, one at a time, and the result is saved against
       * each address.
       */
      if (!demoIds || demoIds.length === 0) {
        const { listDemoUrls, runCheck } = await import("@/lib/marketplace-manager/demo");
        const active = (await listDemoUrls()).filter((d) => d.status === "active");
        const batches = Math.max(1, Math.ceil(active.length / batchSize));
        setTotalBatches(batches);
        const checked: HealthCheckResult[] = [];
        const tally: HealthCheckSummary = { total: 0, healthy: 0, unhealthy: 0, error: 0 };
        for (let i = 0; i < active.length; i++) {
          setCurrentBatch(Math.floor(i / batchSize) + 1);
          const row = active[i];
          try {
            const r = await runCheck(row);
            const status: HealthCheckResult["status"] =
              r.last_result === "offline" ? (r.last_http_status ? "unhealthy" : "error") : "healthy";
            checked.push({
              id: row.id,
              url: row.url,
              status,
              http_status: r.last_http_status ?? null,
              response_time_ms: r.last_response_ms ?? null,
            });
            tally[status] += 1;
          } catch (e) {
            checked.push({
              id: row.id,
              url: row.url,
              status: "error",
              http_status: null,
              response_time_ms: null,
              error: e instanceof Error ? e.message : String(e),
            });
            tally.error += 1;
          }
          tally.total += 1;
          setProgress(Math.round(((i + 1) / active.length) * 100));
          setResults([...checked]);
          setSummary({ ...tally });
        }
        if (!active.length) setProgress(100);
        toast.success(`Health check completed! ${tally.healthy}/${tally.total} healthy`);
        return { results: checked, summary: tally };
      }

      // Specific ids (the broken-demo alerts) keep their own path.
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

        /**
         * The client is imported here rather than at module scope. A static
         * import put this hook in a module cycle whose chunk threw "Cannot
         * access G before initialization" as it evaluated, and every screen
         * that reaches it - Add Demo, the broken-demo alerts, the health panel -
         * fell to the error boundary.
         */
        const { supabase } = await import("@/integrations/supabase/client");
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
