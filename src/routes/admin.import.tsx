import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { useState } from "react";
import { importSupplied16Demos } from "@/lib/marketplace-import-16-demos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/import")({
  head: pageHead("Catalogue Import", "Bulk import tool for the Software Vala product catalogue."),
  component: AdminImportPage,
});

/**
 * The sixteen supplied products, by name only.
 *
 * This list used to print each product beside its live demo host
 * ("Delhi Metro App → delhi-ride-ui.lovable.app", and fifteen more). A route's
 * JSX is compiled into its public chunk, so /assets/admin.import-*.js handed
 * every demo address to anyone who fetched it, signed in or not - the one
 * thing the demo gate exists to protect. The addresses were never needed
 * here: the import itself reads them on the server, from DEMO_CATALOG in
 * marketplace-import-16-demos.ts (and DEMO_URLS in admin-trigger-import.ts),
 * inside a server function whose body never reaches the browser. The page now
 * shows what it is importing and nothing that opens a demo.
 */
const SUPPLIED_DEMO_NAMES = [
  "Delhi Metro App",
  "RetailX Core",
  "EduNex Pro",
  "Medical Research Institute",
  "Fleetio",
  "Infra.Market",
  "Indoor Sports Arena",
  "Blinkit Clone",
  "BoatBook",
  "Outdoor Sports Complex",
  "Sports Equipment Store",
  "Data Science Lab",
  "Festora™",
  "Dental Clinic",
  "Printora™",
  "Decorixa™",
];

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
            {SUPPLIED_DEMO_NAMES.map((name) => (
              <li key={name}>{name} → demo address held on the server</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
