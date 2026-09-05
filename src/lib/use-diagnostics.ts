import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { runBenchmarks, reportError, resolveErrorEvent } from "@/lib/diagnostics.functions";

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["seo"] });
}

export function useRunBenchmarks() {
  const invalidate = useInvalidate();
  const run = useServerFn(runBenchmarks);
  return useMutation({
    mutationFn: () => run(),
    onSuccess: (result) => {
      toast.success(`${result.results.length} benchmark(s) recorded`);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveError() {
  const invalidate = useInvalidate();
  const resolve = useServerFn(resolveErrorEvent);
  return useMutation({
    mutationFn: (id: string) => resolve({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked resolved");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Fire-and-forget browser error reporting used by the root error boundary. */
export function useReportError() {
  const report = useServerFn(reportError);
  return (input: { message: string; name?: string; stack?: string; route?: string }) =>
    void report({ data: input }).catch(() => undefined);
}
