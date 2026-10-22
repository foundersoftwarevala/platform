import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  listSeoProductBrokenLinks,
  listSeoProductCrawlJobs,
  runSiteCrawl,
} from "@/lib/seo-product-crawl.functions";

const CRAWL_JOBS_KEY = ["seo", "technical-crawl-jobs"];
const BROKEN_LINKS_KEY = ["seo", "technical-broken-links"];

export function useSeoProductCrawlJobs(enabled: boolean) {
  const list = useServerFn(listSeoProductCrawlJobs);
  return useQuery({
    queryKey: CRAWL_JOBS_KEY,
    queryFn: () => list(),
    enabled,
    staleTime: 10_000,
  });
}

export function useSeoProductBrokenLinks(enabled: boolean) {
  const list = useServerFn(listSeoProductBrokenLinks);
  return useQuery({
    queryKey: BROKEN_LINKS_KEY,
    queryFn: () => list(),
    enabled,
    staleTime: 10_000,
  });
}

export function useRunSeoProductCrawl() {
  const queryClient = useQueryClient();
  const run = useServerFn(runSiteCrawl);
  return useMutation({
    mutationFn: () => run(),
    onSuccess: async (result) => {
      toast.success(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CRAWL_JOBS_KEY }),
        queryClient.invalidateQueries({ queryKey: BROKEN_LINKS_KEY }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
