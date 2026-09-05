import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { importSupplied16Demos } from "@/lib/marketplace-import-16-demos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/import")({
  component: AdminImportPage,
});

function AdminImportPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await importSupplied16Demos();
      setResult(response);
      toast.success(response.message || "Import completed!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setError(message);
      toast.error(message);
      console.error("Import error:", error);
    } finally {
      setLoading(false);
    }
  };

  const isServiceKeyMissing = error?.includes("SUPABASE_SERVICE_ROLE_KEY");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Demo Import</h1>
          <p className="text-xl text-slate-400">Import 16 supplied demo records into Demo Manager</p>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900 p-6">
          <Button
            onClick={handleImport}
            disabled={loading || isServiceKeyMissing}
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Start Import (16 Demos)"
            )}
          </Button>

          {result && (
            <div className="space-y-3 rounded-lg border border-green-500 bg-green-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <p className="font-mono text-sm text-green-300">{result.message}</p>
              </div>
              <ul className="space-y-1 text-sm text-slate-300">
                <li>✓ Categories imported: {result.categories}</li>
                <li>✓ Products imported: {result.products}</li>
                <li>✓ Demos created: {result.demos}</li>
              </ul>
            </div>
          )}

          {error && (
            <div className="space-y-3 rounded-lg border border-red-500 bg-red-500/5 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="font-mono text-sm text-red-300">{error}</p>
              </div>
              {isServiceKeyMissing && (
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p className="font-semibold">To fix this:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to Supabase Project Settings → API</li>
                    <li>Copy the "Service Role" key (secret_...)</li>
                    <li>Add to .env: <code className="bg-slate-800 px-2 py-1 text-xs">SUPABASE_SERVICE_ROLE_KEY=your_key</code></li>
                    <li>Restart dev server: <code className="bg-slate-800 px-2 py-1 text-xs">npm run dev</code></li>
                    <li>Try import again</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-400">
          <p className="font-semibold text-slate-200">What this does:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Creates 12 marketplace categories</li>
            <li>Upserts 16 marketplace products</li>
            <li>Links 16 demo URLs to products</li>
            <li>Makes demos available to Marketplace &amp; Homepage</li>
          </ul>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-400">
          <p className="font-semibold text-slate-200">Supplied Demos (16 total):</p>
          <ul className="space-y-1 list-disc list-inside text-xs">
            <li>Delhi Metro App → delhi-ride-ui.lovable.app</li>
            <li>RetailX Core → retail-heartbeat-92.lovable.app</li>
            <li>EduNex Pro → grade-grid-quest.lovable.app</li>
            <li>Medical Research Institute → med-sync-vault.lovable.app</li>
            <li>Fleetio → vala-fleet-ui.lovable.app</li>
            <li>Infra.Market → infra-fleet-view.lovable.app</li>
            <li>Indoor Sports Arena → court-squad-pro.lovable.app</li>
            <li>Blinkit Clone → color-dash-delight.lovable.app</li>
            <li>BoatBook → sea-charms-book.lovable.app</li>
            <li>Outdoor Sports Complex → turf-booker-spark.lovable.app</li>
            <li>Sports Equipment Store → sportspark-pos.lovable.app</li>
            <li>Data Science Lab → offline-lab-keeper.lovable.app</li>
            <li>Festora™ → festora-os.lovable.app</li>
            <li>Dental Clinic → tooth-chart-buddy.lovable.app</li>
            <li>Printora™ → printora-news-os.lovable.app</li>
            <li>Decorixa™ → decorix-stage-magic.lovable.app</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
