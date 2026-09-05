import { useQuery } from "@tanstack/react-query";
import { DemoUrlManagerSection } from "@/components/marketplace-manager/sections/DemoUrlManager";
import { useServerFn } from "@/lib/serverFn";
import { listProductsAdmin } from "@/lib/marketplace.functions";
import { listDemoUrls } from "@/lib/marketplace-demo.functions";

export function DemoManagerPanel() {
  const productsFn = useServerFn(listProductsAdmin);
  const demosFn = useServerFn(listDemoUrls);

  const { data: products = [] } = useQuery({
    queryKey: ["demo-manager-product-summary"],
    queryFn: async () => (await productsFn()) as Array<{ id: string; name: string; demo_count?: number; demo_urls?: Array<{ id: string; status?: string }> }> ,
  });

  const { data: demos = [] } = useQuery({
    queryKey: ["demo-manager-demo-summary"],
    queryFn: async () => (await demosFn()) as Array<{ id: string; status?: string }> ,
  });

  const linkedProducts = products.filter((product) => (product.demo_urls?.length ?? 0) > 0).length;
  const activeDemos = demos.filter((demo) => demo.status === "active").length;
  const totalProducts = products.length;

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
      <div className="border-b border-white/10 bg-white/3 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
              Demo Manager
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              Live demo URLs, credentials, product mapping, and health checks
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manage role-based demos by product, test them live, and keep the marketplace demo experience accurate.
            </p>
          </div>
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Connected to marketplace data
          </div>
        </div>
      </div>
      <div className="border-b border-white/10 bg-white/2 px-4 py-4 md:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/75">Marketplace products</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{totalProducts}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/75">Linked to demos</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{linkedProducts}</p>
          </div>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-violet-300/75">Active demo URLs</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{activeDemos}</p>
          </div>
        </div>
      </div>
      <div className="bg-[radial-gradient(1200px_500px_at_top,rgba(56,189,248,0.10),transparent)] p-2 md:p-3">
        <div className="rounded-[22px] border border-white/10 bg-background/80">
          <DemoUrlManagerSection />
        </div>
      </div>
    </div>
  );
}
