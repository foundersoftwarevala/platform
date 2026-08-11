import { useMemo, useState } from "react";
import {
  ArrowLeft, Calculator, Layers, Package, ShoppingCart, FileText,
  KeyRound, BarChart3, Settings, Home, Download, Mail, Crown,
  Medal, Award, Gem, Sparkles, Search, Receipt, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notifyPending } from "@/lib/ui-actions";
import { toast } from "sonner";

type Props = { onBack: () => void };

type TabKey =
  | "home" | "engine" | "tiers" | "products" | "orders"
  | "invoices" | "licenses" | "analytics" | "settings";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "home",      label: "Dashboard",       icon: Home },
  { key: "engine",    label: "Pricing Engine",  icon: Calculator },
  { key: "tiers",     label: "Discount Tiers",  icon: Layers },
  { key: "products",  label: "Products",        icon: Package },
  { key: "orders",    label: "Orders",          icon: ShoppingCart },
  { key: "invoices",  label: "Invoices",        icon: FileText },
  { key: "licenses",  label: "Licenses",        icon: KeyRound },
  { key: "analytics", label: "Analytics",       icon: BarChart3 },
  { key: "settings",  label: "Settings",        icon: Settings },
];

export type TierKey = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "custom";

export const TIERS: Record<TierKey, {
  key: TierKey; label: string; pct: number; icon: any; gradient: string; accent: string; note: string;
}> = {
  bronze:   { key: "bronze",   label: "Bronze Reseller",   pct: 10, icon: Medal, accent: "oklch(0.72 0.14 55)",  gradient: "linear-gradient(135deg, oklch(0.32 0.08 55), oklch(0.45 0.16 45))",  note: "Entry tier" },
  silver:   { key: "silver",   label: "Silver Reseller",   pct: 20, icon: Award, accent: "oklch(0.82 0.03 250)", gradient: "linear-gradient(135deg, oklch(0.36 0.02 250), oklch(0.55 0.04 240))", note: "Growing partner" },
  gold:     { key: "gold",     label: "Gold Reseller",     pct: 30, icon: Crown, accent: "oklch(0.85 0.15 90)",  gradient: "linear-gradient(135deg, oklch(0.38 0.12 80), oklch(0.55 0.18 75))",  note: "Established partner" },
  platinum: { key: "platinum", label: "Platinum Reseller", pct: 40, icon: Gem,   accent: "oklch(0.85 0.06 200)", gradient: "linear-gradient(135deg, oklch(0.36 0.05 210), oklch(0.55 0.1 200))", note: "Premium tier" },
  diamond:  { key: "diamond",  label: "Diamond Reseller",  pct: 50, icon: Sparkles, accent: "oklch(0.85 0.16 280)", gradient: "linear-gradient(135deg, oklch(0.36 0.12 285), oklch(0.55 0.2 275))", note: "Elite tier — max margin" },
  custom:   { key: "custom",   label: "Custom Tier",       pct: 0,  icon: ShieldCheck, accent: "oklch(0.78 0.18 160)", gradient: "linear-gradient(135deg, oklch(0.32 0.08 165), oklch(0.5 0.16 155))", note: "Admin controlled" },
};

export function ResellerPricingWorkspace({ onBack }: Props) {
  const [tab, setTab] = useState<TabKey>("home");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Reseller workspace</div>
          <h1 className="text-xl md:text-2xl font-semibold">Pricing Engine</h1>
        </div>
      </div>

      {/* TOP BAR */}
      <div className="rounded-xl border border-border bg-card/40 backdrop-blur p-1.5 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition",
                  active
                    ? "bg-brand text-brand-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      {tab === "home" && <HomeView onJump={setTab} />}
      {tab === "engine" && <EngineView />}
      {tab === "tiers" && <TiersView />}
      {tab === "products" && <ProductsView />}
      {tab === "orders" && <EmptyTable title="Orders" description="No orders yet. Reseller orders appear here once your storefront receives its first purchase." />}
      {tab === "invoices" && <InvoicesView />}
      {tab === "licenses" && <EmptyTable title="Licenses" description="License keys generated for completed orders will appear here with activation status and renewals." />}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "settings" && <SettingsView />}
    </div>
  );
}

/* ───────────── HOME ───────────── */

function HomeView({ onJump }: { onJump: (t: TabKey) => void }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-2">
        <CardTitle title="How Reseller Pricing Works" subtitle="Profit through discounted purchase price — no commissions, no payouts, no withdrawals." />
        <ol className="mt-4 space-y-2.5 text-sm">
          {[
            "Product opened",
            "System detects your reseller tier",
            "Fetch live product price (MRP)",
            "Apply reseller discount",
            "Apply special offer (if any)",
            "Calculate tax",
            "Generate invoice",
            "Display final payable",
            "Payment → License generation → Activation",
          ].map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand text-xs font-semibold">{i + 1}</span>
              <span className="text-foreground/90">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle title="Your Tier" subtitle="Server-detected from your account." />
        <div className="mt-4 rounded-xl p-4 text-white" style={{ background: TIERS.gold.gradient }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-80">Current tier</div>
          <div className="mt-1 text-2xl font-bold">Gold</div>
          <div className="mt-1 text-sm opacity-90">30% discount on every reseller-eligible product.</div>
        </div>
        <button
          onClick={() => onJump("engine")}
          className="mt-4 w-full rounded-lg bg-brand text-brand-foreground py-2.5 text-sm font-medium shadow-glow hover:opacity-95"
        >
          Open Pricing Engine
        </button>
      </Card>

      <Card className="md:col-span-3">
        <CardTitle title="Benefits" subtitle="Why discounted pricing beats commissions." />
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            "No commission tracking",
            "No commission payouts",
            "No withdrawal requests",
            "No commission disputes",
            "Simple pricing model",
            "Instant profit visibility",
            "Automatic billing",
            "Automatic invoice",
            "Automatic license generation",
          ].map((b) => (
            <div key={b} className="rounded-lg border border-border bg-white/[0.02] px-3.5 py-3 text-sm flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {b}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ───────────── PRICING ENGINE ───────────── */

function EngineView() {
  const [mrp, setMrp] = useState(249);
  const [tier, setTier] = useState<TierKey>("gold");
  const [partner, setPartner] = useState(0);
  const [offer, setOffer] = useState(0);
  const [tax, setTax] = useState(18);

  const result = useMemo(() => {
    const tierPct = TIERS[tier].pct;
    const afterTier = mrp * (1 - tierPct / 100);
    const afterPartner = afterTier * (1 - partner / 100);
    const afterOffer = afterPartner * (1 - offer / 100);
    const taxAmount = afterOffer * (tax / 100);
    const payable = afterOffer + taxAmount;
    const saved = mrp - afterOffer;
    return {
      tierPct, afterTier, afterPartner, afterOffer, taxAmount, payable, saved,
    };
  }, [mrp, tier, partner, offer, tax]);

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Card className="lg:col-span-3">
        <CardTitle title="Pricing Inputs" subtitle="Calculate the exact final payable for any product." />
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <Field label="MRP Price" suffix="USD">
            <input type="number" value={mrp} onChange={(e) => setMrp(Number(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Reseller Discount" suffix="%">
            <select value={tier} onChange={(e) => setTier(e.target.value as TierKey)} className={inputCls}>
              {Object.values(TIERS).filter(t => t.key !== "custom").map((t) => (
                <option key={t.key} value={t.key}>{t.label} — {t.pct}%</option>
              ))}
            </select>
          </Field>
          <Field label="Partner Discount" suffix="%">
            <input type="number" value={partner} onChange={(e) => setPartner(Number(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Special Offer" suffix="%">
            <input type="number" value={offer} onChange={(e) => setOffer(Number(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Tax (GST/VAT)" suffix="%">
            <input type="number" value={tax} onChange={(e) => setTax(Number(e.target.value) || 0)} className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle title="Breakdown" subtitle="Live calculation." />
        <div className="mt-4 space-y-2.5 text-sm">
          <Row label="MRP" value={fmt(mrp)} />
          <Row label={`Reseller Discount (${result.tierPct}%)`} value={`− ${fmt(mrp - result.afterTier)}`} muted />
          {partner > 0 && <Row label={`Partner Discount (${partner}%)`} value={`− ${fmt(result.afterTier - result.afterPartner)}`} muted />}
          {offer > 0 && <Row label={`Special Offer (${offer}%)`} value={`− ${fmt(result.afterPartner - result.afterOffer)}`} muted />}
          <div className="my-2 border-t border-border" />
          <Row label="Final Purchase Price" value={fmt(result.afterOffer)} strong />
          <Row label={`Tax (${tax}%)`} value={`+ ${fmt(result.taxAmount)}`} muted />
          <div className="my-2 border-t border-border" />
          <Row label="Final Payable" value={fmt(result.payable)} highlight />
          <Row label="You Save" value={fmt(result.saved)} success />
        </div>
        <button
          type="button"
          onClick={() => toast.success("Invoice generated", { description: "Review it in the Invoice Preview panel, then export as PDF or email it." })}
          className="press-3d mt-5 w-full rounded-lg bg-brand text-brand-foreground py-2.5 text-sm font-medium shadow-glow hover:opacity-95"
        >
          Generate Invoice
        </button>
      </Card>

      <Card className="lg:col-span-5">
        <CardTitle title="Invoice Preview" subtitle="Auto-generated, production-ready." />
        <InvoicePreview mrp={mrp} tierLabel={TIERS[tier].label} tierPct={result.tierPct}
          partner={partner} offer={offer} taxPct={tax}
          subtotal={result.afterOffer} taxAmount={result.taxAmount} payable={result.payable} />
      </Card>

      <Card className="lg:col-span-5">
        <CardTitle title="Worked Examples" subtitle="Two sample products at different tiers." />
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <ExampleCard mrp={249} pct={30} />
          <ExampleCard mrp={249} pct={50} />
        </div>
      </Card>
    </div>
  );
}

function ExampleCard({ mrp, pct }: { mrp: number; pct: number }) {
  const final = mrp * (1 - pct / 100);
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Example</div>
      <div className="mt-1 text-sm">MRP <span className="font-semibold">{fmt(mrp)}</span> · Discount <span className="font-semibold">{pct}%</span></div>
      <div className="mt-3 text-2xl font-bold text-brand">{fmt(final)}</div>
      <div className="text-xs text-muted-foreground">Final price (pre-tax)</div>
    </div>
  );
}

/* ───────────── DISCOUNT TIERS ───────────── */

function TiersView() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.values(TIERS).map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.key} className="rounded-xl overflow-hidden border border-border bg-card/40">
            <div className="p-5 text-white relative" style={{ background: t.gradient }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-85">
                  <Icon className="h-4 w-4" /> {t.note}
                </div>
              </div>
              <div className="mt-3 text-xl font-bold">{t.label}</div>
              <div className="mt-1 text-4xl font-extrabold">
                {t.key === "custom" ? "—" : `${t.pct}%`}
              </div>
              <div className="text-xs opacity-85 mt-1">
                {t.key === "custom" ? "Admin controlled" : "discount on MRP"}
              </div>
            </div>
            <div className="p-4 text-sm text-muted-foreground">
              {t.key === "custom"
                ? "Negotiated tier with custom discount, product-specific overrides and category rules."
                : `Apply to every reseller-eligible product. Stacks with partner & special offers per admin rules.`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── PRODUCTS ───────────── */

function ProductsView() {
  const [catalogQuery, setCatalogQuery] = useState("");
  return (
    <Card>
      <CardTitle title="Reseller Product Catalog" subtitle="Live MRP, your discount, your price, tax, and final payable for each product." />
      <div className="mt-4 flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            aria-label="Search the reseller catalog"
            placeholder="Search the reseller catalog…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <button
          type="button"
          onClick={() => notifyPending("Catalog filters", "Filters activate as soon as the catalog API is connected.")}
          className="press-3d shrink-0 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card"
        >
          Filters
        </button>
      </div>
      <div className="mt-5 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <Package className="mx-auto h-6 w-6 mb-2 opacity-70" />
        {catalogQuery.trim()
          ? `No catalog products match “${catalogQuery.trim()}” yet.`
          : "No reseller products are wired to this account yet."}
        <div className="mt-1 text-xs">Once the catalog API is connected, each product card shows MRP · Your Discount · Your Price · You Save · Tax · Final Payable · Buy Now · Generate Invoice.</div>
      </div>
    </Card>
  );
}

/* ───────────── INVOICES ───────────── */

function InvoicesView() {
  return (
    <Card>
      <CardTitle title="Invoices" subtitle="Auto-generated for every purchase. Download PDF or email to client." />
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-muted-foreground">
            <tr>
              {["Invoice #", "Product", "License", "Discount", "Tax", "Final", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left font-medium px-4 py-2.5 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                <Receipt className="mx-auto h-6 w-6 mb-2 opacity-70" />
                No invoices yet. Your first reseller purchase will generate Invoice #INV-0001 automatically.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ───────────── ANALYTICS ───────────── */

function AnalyticsView() {
  const items = [
    { label: "Total Savings",         value: "—", hint: "Sum of MRP minus your price" },
    { label: "Total Purchases",       value: "—", hint: "All-time reseller orders" },
    { label: "Total Discount Earned", value: "—", hint: "Aggregate tier + offer savings" },
    { label: "Monthly Spending",      value: "—", hint: "Current billing cycle" },
    { label: "Active Licenses",       value: "—", hint: "Currently activated keys" },
    { label: "Renewals (30d)",        value: "—", hint: "Due within 30 days" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card/40 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{m.label}</div>
            <div className="mt-2 text-2xl font-bold">{m.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{m.hint}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardTitle title="Top Purchased Products" subtitle="Ranked by units, populated once order data is available." />
        <div className="mt-3 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No purchase data yet.
        </div>
      </Card>
    </div>
  );
}

/* ───────────── SETTINGS (ADMIN CONTROL) ───────────── */

function SettingsView() {
  const groups = [
    { title: "Tier management", items: ["Create Tier", "Edit Tier", "Assign Tier", "Custom Discount"] },
    { title: "Discount rules",  items: ["Product Specific Discount", "Category Specific Discount", "Global Discount Rules", "Discount Expiry"] },
    { title: "Billing",         items: ["Default Currency", "Tax Profile", "Invoice Numbering", "Email Template"] },
  ];
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {groups.map((g) => (
        <Card key={g.title}>
          <CardTitle title={g.title} subtitle="Admin controlled." />
          <ul className="mt-3 space-y-2">
            {g.items.map((it) => (
              <li key={it} className="flex items-center justify-between rounded-lg border border-border bg-white/[0.02] px-3 py-2.5 text-sm">
                <span>{it}</span>
                <button
                  type="button"
                  onClick={() => notifyPending(`${it}`, "This setting is admin controlled and syncs from your existing Software Vala configuration.")}
                  className="text-xs text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Configure
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ───────────── INVOICE PREVIEW ───────────── */

function InvoicePreview({
  mrp, tierLabel, tierPct, partner, offer, taxPct, subtotal, taxAmount, payable,
}: {
  mrp: number; tierLabel: string; tierPct: number; partner: number; offer: number;
  taxPct: number; subtotal: number; taxAmount: number; payable: number;
}) {
  const invoiceNo = "INV-PREVIEW";
  return (
    <div className="mt-4 rounded-xl border border-border bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tax Invoice</div>
          <div className="text-base font-semibold">{invoiceNo}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.print(); }}
            className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs hover:bg-card"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <button
            type="button"
            onClick={() => notifyPending("Email invoice", "Invoices send through your existing transactional email service once connected.")}
            className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs hover:bg-card"
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>
      </div>
      <div className="px-5 py-4 grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Reseller tier</div>
          <div className="font-medium">{tierLabel}</div>
        </div>
        <div className="sm:text-right">
          <div className="text-xs text-muted-foreground">Status</div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Awaiting payment
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 text-sm">
        <Row label="MRP"                          value={fmt(mrp)} />
        <Row label={`Reseller Discount (${tierPct}%)`} value={`− ${fmt(mrp * tierPct / 100)}`} muted />
        {partner > 0 && <Row label={`Partner Discount (${partner}%)`} value="applied" muted />}
        {offer > 0 && <Row label={`Special Offer (${offer}%)`} value="applied" muted />}
        <div className="my-2 border-t border-border" />
        <Row label="Subtotal"      value={fmt(subtotal)} strong />
        <Row label={`Tax (${taxPct}%)`} value={`+ ${fmt(taxAmount)}`} muted />
        <div className="my-2 border-t border-border" />
        <Row label="Final Payable" value={fmt(payable)} highlight />
      </div>
    </div>
  );
}

/* ───────────── shared ui ───────────── */

const inputCls = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card/40 backdrop-blur p-5", className)}>{children}</div>;
}
function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
      {children}
    </label>
  );
}
function Row({ label, value, muted, strong, highlight, success }: {
  label: string; value: string; muted?: boolean; strong?: boolean; highlight?: boolean; success?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn("text-sm", muted ? "text-muted-foreground" : "text-foreground/90")}>{label}</span>
      <span className={cn(
        "text-sm tabular-nums",
        strong && "font-semibold",
        highlight && "text-brand text-base font-bold",
        success && "text-emerald-400 font-medium",
      )}>{value}</span>
    </div>
  );
}
function EmptyTable({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardTitle title={title} subtitle={description} />
      <div className="mt-5 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        No {title.toLowerCase()} yet.
      </div>
    </Card>
  );
}
function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
