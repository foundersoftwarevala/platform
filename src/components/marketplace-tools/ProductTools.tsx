import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight, Check, Columns3, Loader2, Search, Sparkles, Star, X,
} from "lucide-react";

/**
 * The four marketplace tools behind the AI Zone cards.
 *
 * All of them read the real catalogue through /api/marketplace/search — the
 * same products, prices and demo links the storefront sells. None of them
 * fabricates a product, a price or an answer.
 */

export type ToolProduct = {
  id: string;
  slug: string;
  name: string;
  industry_label?: string | null;
  icon?: string | null;
  rating?: number | null;
  downloads_label?: string | null;
  badge?: string | null;
  has_demo?: boolean;
  price_label?: string | null;
  description?: string | null;
  tech_stack?: string | string[] | null;
  features?: string | string[] | null;
  modules?: string | string[] | null;
  deployment?: string | null;
  license?: string | null;
  version?: string | null;
  reason?: string | null;
  pricing?: { amount: number; currency: string } | null;
};

const money = (product: ToolProduct) => {
  if (product.pricing) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: product.pricing.currency,
        maximumFractionDigits: 0,
      }).format(product.pricing.amount);
    } catch {
      return `${product.pricing.currency} ${product.pricing.amount}`;
    }
  }
  return product.price_label ?? "See product";
};

/**
 * `marketplace_products.icon` holds either an emoji or a Lucide icon name such
 * as "Stethoscope". Only the emoji form can be printed; a name would show up as
 * stray text, so anything wordy falls back to a neutral glyph.
 */
const isGlyph = (icon: string | null | undefined) =>
  !!icon && icon.trim().length > 0 && icon.trim().length <= 3 && !/[a-zA-Z]/.test(icon);

const asList = (value: string | string[] | null | undefined): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

/** Shared page frame so every tool looks like the same product. */
export const ToolShell = ({
  title, tagline, children,
}: {
  title: string;
  tagline: string;
  children: ReactNode;
}) => (
  <main className="min-h-screen bg-[#050b18] px-4 py-10 text-white sm:px-6 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <a
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        ← Back to marketplace
      </a>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
        <Sparkles className="h-3 w-3" aria-hidden="true" /> AI Zone
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-white/60">{tagline}</p>
      <div className="mt-8">{children}</div>
    </div>
  </main>
);

/** A single product, rendered the same way in every tool. */
export const ProductCard = ({
  product, action,
}: {
  product: ToolProduct;
  action?: ReactNode;
}) => (
  <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.05] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 text-lg">
        {isGlyph(product.icon) ? product.icon : "🧩"}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold">{product.name}</h3>
        {product.industry_label && (
          <p className="truncate text-[11px] text-white/50">{product.industry_label}</p>
        )}
      </div>
      {product.badge && (
        <span className="ml-auto shrink-0 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
          {product.badge}
        </span>
      )}
    </div>

    {product.reason && (
      <p className="mt-3 text-[11px] font-medium text-cyan-300/90">{product.reason}</p>
    )}

    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
      <span className="font-bold text-white">{money(product)}</span>
      {product.rating ? (
        <span className="inline-flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
          {Number(product.rating).toFixed(1)}
        </span>
      ) : null}
      {product.downloads_label && <span>{product.downloads_label}</span>}
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <a
        href={`/marketplace/product/${product.slug}`}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        View product
      </a>
      {product.has_demo && (
        <a
          href={`/demo/${product.slug}`}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          Live demo
        </a>
      )}
      {action}
    </div>
  </article>
);

/** Shared fetch with loading, empty and failure states handled once. */
function useCatalogue(queryString: string | null) {
  const [products, setProducts] = useState<ToolProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    if (queryString === null) {
      setProducts(null);
      setError(null);
      return;
    }
    const ticket = ++request.current;
    setProducts(null);
    setError(null);
    fetch(`/api/marketplace/search?${queryString}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (ticket !== request.current) return;
        setProducts(Array.isArray(data.products) ? data.products : []);
      })
      .catch(() => {
        if (ticket !== request.current) return;
        setError("We could not reach the catalogue. Please try again.");
        setProducts([]);
      });
  }, [queryString]);

  return { products, error };
}

const Skeletons = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
    ))}
  </div>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-white/60">
    {children}
  </p>
);

/* ------------------------------------------------------------------ finder */

export const ProductFinder = () => {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const { products, error } = useCatalogue(query);

  const examples = [
    "clinic with appointments and billing",
    "school management with fees and attendance",
    "multi vendor ecommerce store",
    "hotel booking and front desk",
  ];

  const run = useCallback((value: string) => {
    const text = value.trim();
    if (!text) return;
    setDraft(text);
    setQuery(`q=${encodeURIComponent(text)}&limit=12`);
  }, []);

  return (
    <ToolShell
      title="AI Product Finder"
      tagline="Describe what your business needs and we match it against the real catalogue — every result is a product you can open, demo and buy today."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(draft);
        }}
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
      >
        <label className="sr-only" htmlFor="finder-input">
          Describe what you need
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
            aria-hidden="true"
          />
          <input
            id="finder-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. dental clinic with appointments, billing and reports"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-400/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          Find products
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => run(example)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/60 hover:border-cyan-400/40 hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-8" aria-live="polite">
        {query === null ? (
          <Empty>Describe your requirement above to see matching products.</Empty>
        ) : products === null ? (
          <Skeletons />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : products.length === 0 ? (
          <Empty>
            Nothing in the catalogue matched that yet. Try fewer words, or{" "}
            <a href="/marketplace" className="font-semibold text-cyan-300 underline">
              browse all categories
            </a>
            .
          </Empty>
        ) : (
          <>
            <p className="mb-4 text-xs text-white/50">
              {products.length} matching {products.length === 1 ? "product" : "products"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
};

/* --------------------------------------------------------- recommendations */

export const Recommendations = () => {
  const { products, error } = useCatalogue("mode=popular&limit=12");

  return (
    <ToolShell
      title="AI Recommendation"
      tagline="What the marketplace is actually opening right now, drawn from real product views and demo clicks — not a curated list."
    >
      <div aria-live="polite">
        {products === null ? (
          <Skeletons />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : products.length === 0 ? (
          <Empty>
            There is not enough activity to recommend from yet.{" "}
            <a href="/marketplace" className="font-semibold text-cyan-300 underline">
              Browse the catalogue
            </a>
            .
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </ToolShell>
  );
};

/* ----------------------------------------------------------------- compare */

const COMPARE_ROWS: Array<{ label: string; get: (p: ToolProduct) => string }> = [
  { label: "Price", get: money },
  { label: "Category", get: (p) => p.industry_label ?? "—" },
  { label: "Rating", get: (p) => (p.rating ? `${Number(p.rating).toFixed(1)} / 5` : "—") },
  { label: "Version", get: (p) => p.version ?? "—" },
  { label: "Licence", get: (p) => p.license ?? "—" },
  { label: "Deployment", get: (p) => p.deployment ?? "—" },
  { label: "Tech stack", get: (p) => asList(p.tech_stack).join(", ") || "—" },
  { label: "Modules", get: (p) => asList(p.modules).slice(0, 6).join(", ") || "—" },
  { label: "Live demo", get: (p) => (p.has_demo ? "Available" : "Not published yet") },
];

export const CompareTool = () => {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ToolProduct[]>([]);
  const { products, error } = useCatalogue(query);

  const add = (product: ToolProduct) => {
    setChosen((prev) =>
      prev.some((p) => p.id === product.id) || prev.length >= 4 ? prev : [...prev, product],
    );
  };
  const remove = (id: string) => setChosen((prev) => prev.filter((p) => p.id !== id));

  return (
    <ToolShell
      title="AI Compare"
      tagline="Put up to four real products side by side — price, stack, modules, licence and demo availability, straight from the catalogue."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setQuery(`q=${encodeURIComponent(draft.trim())}&limit=9`);
        }}
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
      >
        <label className="sr-only" htmlFor="compare-input">
          Search products to compare
        </label>
        <input
          id="compare-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search products to compare, e.g. clinic, school, ecommerce"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-400/60 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          Search
        </button>
      </form>

      {chosen.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Side-by-side product comparison</caption>
            <thead>
              <tr>
                <th scope="col" className="w-40 p-3 text-left text-[11px] uppercase tracking-wider text-white/50">
                  Attribute
                </th>
                {chosen.map((p) => (
                  <th key={p.id} scope="col" className="p-3 text-left align-top">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate font-bold text-white">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        aria-label={`Remove ${p.name} from the comparison`}
                        className="rounded p-0.5 text-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-white/5">
                  <th scope="row" className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    {row.label}
                  </th>
                  {chosen.map((p) => (
                    <td key={p.id} className="p-3 align-top text-white/85">
                      {row.get(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-white/5">
                <th scope="row" className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Open
                </th>
                {chosen.map((p) => (
                  <td key={p.id} className="p-3">
                    <a
                      href={`/marketplace/product/${p.slug}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-gray-900"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8" aria-live="polite">
        {query === null ? (
          <Empty>Search for products above, then add up to four to compare.</Empty>
        ) : products === null ? (
          <Skeletons />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : products.length === 0 ? (
          <Empty>No products matched that search.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const picked = chosen.some((c) => c.id === p.id);
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  action={
                    <button
                      type="button"
                      onClick={() => add(p)}
                      disabled={picked || chosen.length >= 4}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                    >
                      {picked ? <Check className="h-3 w-3" /> : <Columns3 className="h-3 w-3" />}
                      {picked ? "Added" : "Compare"}
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </ToolShell>
  );
};

/* --------------------------------------------------------------- assistant */

type Turn = { from: "you" | "vala"; text: string; products?: ToolProduct[] };

/**
 * The sales assistant answers from the catalogue and from the published FAQ,
 * and hands anything it cannot answer to a real person through the existing
 * lead pipeline. There is no language model behind it, and it never claims
 * otherwise — every answer it gives is traceable to a real record.
 */
export const SalesAssistant = ({ faqs }: { faqs: { question: string; answer: string }[] }) => {
  const [turns, setTurns] = useState<Turn[]>([
    {
      from: "vala",
      text:
        "Ask me about any product, price, demo or licence and I will answer from the live catalogue. " +
        "If I cannot answer it, I will pass you to the team.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const answerFromFaq = useMemo(
    () => (question: string) => {
      const words = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      let best: { faq: { question: string; answer: string }; hits: number } | null = null;
      for (const faq of faqs) {
        const text = `${faq.question} ${faq.answer}`.toLowerCase();
        const hits = words.filter((w) => text.includes(w)).length;
        if (hits >= 2 && (!best || hits > best.hits)) best = { faq, hits };
      }
      return best?.faq.answer ?? null;
    },
    [faqs],
  );

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((prev) => [...prev, { from: "you", text: question }]);

    try {
      const response = await fetch(`/api/marketplace/search?q=${encodeURIComponent(question)}&limit=3`);
      const data = response.ok ? await response.json() : { products: [] };
      const products: ToolProduct[] = Array.isArray(data.products) ? data.products : [];
      const faqAnswer = answerFromFaq(question);

      if (products.length) {
        setTurns((prev) => [
          ...prev,
          {
            from: "vala",
            text: faqAnswer
              ? faqAnswer
              : `Here ${products.length === 1 ? "is a product" : "are the products"} in the catalogue that fit that:`,
            products,
          },
        ]);
      } else if (faqAnswer) {
        setTurns((prev) => [...prev, { from: "vala", text: faqAnswer }]);
      } else {
        setTurns((prev) => [
          ...prev,
          {
            from: "vala",
            text:
              "I could not find that in the catalogue or the FAQ, so I do not want to guess. " +
              "Leave your details and someone from the team will answer you directly.",
          },
        ]);
        setHandoff(true);
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        { from: "vala", text: "I could not reach the catalogue just now. Please try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="Sales Assistant"
      tagline="Answers come from the live catalogue and the published FAQ. When there is no real answer, you are handed to the team rather than given a guess."
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="max-h-[55vh] space-y-4 overflow-y-auto p-4" aria-live="polite">
          {turns.map((turn, i) => (
            <div key={i} className={turn.from === "you" ? "text-right" : ""}>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-sm ${
                  turn.from === "you"
                    ? "bg-white text-gray-900"
                    : "border border-white/10 bg-white/5 text-white/85"
                }`}
              >
                {turn.text}
              </div>
              {turn.products && turn.products.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {turn.products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking the catalogue…
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3">
          <label className="sr-only" htmlFor="assistant-input">
            Ask about a product
          </label>
          <input
            id="assistant-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a product, price, demo or licence…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-cyan-400/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            Ask
          </button>
        </form>
      </div>

      {handoff && (
        <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.06] p-5">
          <h2 className="text-sm font-bold text-white">Talk to a person</h2>
          <p className="mt-1 text-xs text-white/60">
            We will reply on the details you leave here.
          </p>
          <a
            href="/support"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
          >
            Contact support <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </ToolShell>
  );
};
