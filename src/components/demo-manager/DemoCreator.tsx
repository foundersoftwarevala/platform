import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Search, ShieldCheck, Sparkles, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authHeaders } from "@/lib/auth/operator-fetch";

/**
 * Demo Manager → Add Demo.
 *
 * An operator names the product and the address of its demo. The server
 * (/api/demo/process) fetches the demo safely, asks the AI Manager what the
 * software is, which marketplace category it belongs to and which contact
 * details and branding are the developer's, and records the answer on the
 * product's demo. Activating re-checks the Software Vala presentation of the
 * demo and only then makes it the product's live demo - the LIVE DEMO badge
 * on its marketplace card.
 */

type Finding = { value: string; kind?: string; reason?: string };
type Processing = {
  error?: string;
  ai?: { service?: string; model?: string | null };
  source?: { final_url?: string; http_status?: number; bundles?: number };
  identity?: {
    software_name?: string | null;
    summary?: string | null;
    category_name?: string | null;
    category_reason?: string | null;
    confidence?: number | null;
    product_category_matches?: boolean | null;
  };
  findings?: {
    contacts?: Finding[];
    branding?: Finding[];
    developer_links?: Finding[];
    logos?: Finding[];
    kept?: Finding[];
    dropped?: { value: string; reason: string }[];
  };
  evidence?: { favicons?: string[] };
  verification?: { ok: boolean; checks: { check: string; ok: boolean; detail?: string }[] };
};
type DemoRow = {
  id: string;
  url: string;
  demo_name: string;
  status: string;
  processing_status: string;
  processing: Processing | null;
  updated_at: string;
  marketplace_products?: { name: string; slug: string } | null;
};
type Product = { id: string; name: string; slug: string; marketplace_categories?: { name: string } | null };

const ENDPOINT = "/api/demo/process";

async function call<T>(init?: RequestInit, query = ""): Promise<T> {
  const response = await fetch(`${ENDPOINT}${query}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeaders()), ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body;
}

const STATE_STYLE: Record<string, string> = {
  investigating: "bg-sky-500/20 text-sky-300",
  review: "bg-amber-500/20 text-amber-300",
  live: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
};

function List({ title, items, tone }: { title: string; items?: Finding[]; tone: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((f) => (
          <li key={f.value} className="text-xs">
            <code className={`rounded px-1 ${tone}`}>{f.value}</code>{" "}
            <span className="text-muted-foreground">{f.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoResult({ demo, onActivate, busy }: { demo: DemoRow; onActivate: () => void; busy: boolean }) {
  const p = demo.processing ?? {};
  const slug = demo.marketplace_products?.slug;
  return (
    <div className="glass-panel space-y-4 p-5" data-demo-id={demo.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{demo.demo_name}</p>
          <p className="text-xs text-muted-foreground">
            {demo.marketplace_products?.name} · <code>{demo.url}</code>
          </p>
        </div>
        <Badge className={STATE_STYLE[demo.processing_status] ?? ""} data-processing-status={demo.processing_status}>
          {demo.processing_status.toUpperCase()}
        </Badge>
      </div>

      {p.error && <p className="text-sm text-red-400">{p.error}</p>}

      {p.identity && (
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">AI Manager: </span>
            {p.ai?.service} {p.ai?.model ? `(${p.ai.model})` : ""}
          </p>
          <p>
            <span className="text-muted-foreground">Category: </span>
            <strong data-detected-category>{p.identity.category_name ?? "—"}</strong>
            {p.identity.product_category_matches === false && (
              <span className="text-amber-400"> (differs from the product's catalogue category, which is not changed)</span>
            )}
          </p>
          <p className="md:col-span-2 text-muted-foreground">{p.identity.summary}</p>
          <p className="md:col-span-2 text-xs text-muted-foreground">{p.identity.category_reason}</p>
        </div>
      )}

      {p.findings && (
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Developer contact removed" items={p.findings.contacts} tone="bg-red-500/15" />
          <List title="Developer links removed" items={p.findings.developer_links} tone="bg-red-500/15" />
          <List title="Shown as Software Vala" items={p.findings.branding} tone="bg-sky-500/15" />
          <List title="Logo replaced with Software Vala logo" items={p.findings.logos} tone="bg-sky-500/15" />
          <List title="Kept (application data)" items={p.findings.kept} tone="bg-emerald-500/15" />
          <List title="Ignored (not verifiable in the demo)" items={p.findings.dropped} tone="bg-muted" />
          <p className="text-xs text-muted-foreground md:col-span-2">
            Favicon: {p.evidence?.favicons?.length ?? 0} → Software Vala favicon.
          </p>
        </div>
      )}

      {p.verification && (
        <ul className="space-y-1 text-xs" data-verification={p.verification.ok ? "pass" : "fail"}>
          {p.verification.checks.map((c) => (
            <li key={c.check} className="flex items-center gap-2">
              {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
              {c.check} {c.detail ? <span className="text-muted-foreground">— {c.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {demo.processing_status === "review" && (
          <Button onClick={onActivate} disabled={busy} data-action="activate">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Verify and activate
          </Button>
        )}
        {demo.processing_status === "live" && slug && (
          <>
            <a href={`/demo/${slug}`} target="_blank" rel="noreferrer">
              <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Open live demo</Button>
            </a>
            <a href={`/marketplace/product/${slug}`} target="_blank" rel="noreferrer">
              <Button variant="outline">Marketplace product</Button>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

const DemoCreator = () => {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [url, setUrl] = useState("");
  const [demos, setDemos] = useState<DemoRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDemos((await call<{ demos: DemoRow[] }>()).demos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (product || query.trim().length < 2) {
      setProducts([]);
      return;
    }
    const timer = setTimeout(() => {
      call<{ products: Product[] }>(undefined, `?products=${encodeURIComponent(query.trim())}`)
        .then((r) => setProducts(r.products))
        .catch((e) => setError(String(e.message ?? e)));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, product]);

  const act = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await call<{ demo: DemoRow }>({ method: "POST", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-mono font-bold text-foreground">Add Demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a demo address. It is investigated with the AI Manager, shown with Software Vala branding, and goes live only after it is verified.
        </p>
      </div>

      <div className="glass-panel space-y-4 p-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="demo-product">Product</label>
          {product ? (
            <div className="flex items-center gap-2 text-sm" data-selected-product={product.slug}>
              <strong>{product.name}</strong>
              <span className="text-muted-foreground">{product.marketplace_categories?.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setProduct(null)}>Change</Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="demo-product" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalogue by product name" />
              {products.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover text-sm shadow-lg">
                  {products.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" data-product-option={p.slug} onClick={() => { setProduct(p); setProducts([]); }}>
                        {p.name} <span className="text-muted-foreground">· {p.marketplace_categories?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="demo-url">Demo address</label>
          <Input id="demo-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <Button
          data-action="investigate"
          disabled={!product || !url.trim() || busy !== null}
          onClick={() => void act("investigate", { action: "investigate", productId: product?.id, url: url.trim() })}
        >
          {busy === "investigate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Investigate with AI
        </Button>
      </div>

      <div className="space-y-4">
        {demos.map((demo) => (
          <DemoResult
            key={demo.id}
            demo={demo}
            busy={busy === demo.id}
            onActivate={() => void act(demo.id, { action: "activate", id: demo.id })}
          />
        ))}
      </div>
    </div>
  );
};

export default DemoCreator;
