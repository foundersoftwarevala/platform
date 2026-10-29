import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  generateBulkResellerSeoAssets,
  listBulkResellerSeoAssets,
} from "@/lib/seo-bulk-reseller.functions";

const QUERY_KEY = ["seo", "bulk-reseller-assets"];

export default function BulkResellerSeoModule() {
  const queryClient = useQueryClient();
  const assets = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listBulkResellerSeoAssets(),
  });
  const generate = useMutation({
    mutationFn: () => generateBulkResellerSeoAssets(),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Generated ${created.length} reseller SEO drafts.`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not generate reseller SEO drafts.",
      );
    },
  });

  const copyAll = async () => {
    if (!assets.data?.length) return;
    const header = [
      "Country",
      "Keyword",
      "Hashtags",
      "Meta title",
      "Meta description",
      "Application URL",
      "Status",
    ];
    const rows = assets.data.map((asset) => [
      asset.country,
      asset.keyword,
      asset.hashtag,
      asset.meta_title,
      asset.meta_description,
      asset.backlink_url,
      asset.status,
    ]);
    const tsv = [header, ...rows].map((row) => row.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success("Reseller SEO drafts copied.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not copy the reseller SEO drafts.",
      );
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Bulk Reseller SEO</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Generate country-specific hashtags and metadata as review-only drafts. Every record
            includes the existing reseller application URL and #SoftwareVala. No external backlink
            placements are invented or published.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => void copyAll()} disabled={!assets.data?.length}>
            <Copy className="mr-2 h-4 w-4" />
            Copy All
          </Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generate.isPending ? "Generating…" : "Generate Reseller SEO Assets"}
          </Button>
        </div>
      </header>

      <div className="rounded-xl border border-border">
        {assets.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading saved SEO drafts…</p>
        ) : assets.isError ? (
          <div className="space-y-3 p-6">
            <p className="text-sm text-destructive">
              {assets.error instanceof Error ? assets.error.message : "Could not load SEO drafts."}
            </p>
            <Button variant="outline" onClick={() => void assets.refetch()}>
              Try again
            </Button>
          </div>
        ) : !assets.data?.length ? (
          <p className="p-6 text-sm text-muted-foreground">
            No reseller SEO drafts yet. Generate assets to create ten country-specific review
            records.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Hashtags</TableHead>
                  <TableHead>Meta title & description</TableHead>
                  <TableHead>Application URL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.data.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="whitespace-nowrap font-medium">{asset.country}</TableCell>
                    <TableCell className="min-w-48">{asset.keyword}</TableCell>
                    <TableCell className="min-w-64 break-words text-xs">{asset.hashtag}</TableCell>
                    <TableCell className="min-w-72">
                      <p className="font-medium">{asset.meta_title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{asset.meta_description}</p>
                    </TableCell>
                    <TableCell className="min-w-56">
                      <a
                        href={asset.backlink_url}
                        className="break-all text-primary underline-offset-4 hover:underline"
                      >
                        {asset.backlink_url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Drafts are stored in VPS Postgres for review. The application URL is the campaign CTA
        destination; no third-party site is contacted or automatically posted to.
      </p>
    </section>
  );
}
