import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  KeyRound, Download, ShoppingBag, Receipt, CreditCard, Wallet, Banknote,
  QrCode, Rocket, Copy, RefreshCw, ShieldCheck, Fingerprint, Cpu, Globe2,
  Timer, ArrowUpRight, ArrowDownRight, Repeat, RotateCcw, Ban, Sparkles,
  Zap, GitBranch, GitCommit, GitMerge, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, Plus, FileDown, Send, Eye, Trash2, Pencil, Search, Filter,
  MoreHorizontal, Printer, DollarSign, TrendingUp, Package, Server, Cloud,
  Smartphone, Monitor, Link2, Percent, Gift, TicketPercent, BadgeCheck,
  Users, Building2, HardDrive, Signal, ShieldAlert, Hash, ScanLine,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { TableToolbar, RowActions } from "../actions";

/* =============================================================
   Shared atoms
   ============================================================= */

function Switch({ on = false }: { on?: boolean }) {
  const [v, setV] = useState(on);
  return (
    <button
      onClick={() => setV(!v)}
      className={`relative h-5 w-9 rounded-full transition-colors ${v ? "bg-gradient-to-r from-primary to-accent" : "bg-secondary"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${v ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "premium" | "info" | "danger";
}) {
  const map: Record<string, string> = {
    neutral: "border-border bg-white/[0.05] text-muted-foreground",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    premium: "border-premium/40 bg-premium/10 text-premium",
    info:    "border-accent/40 bg-accent/10 text-accent",
    danger:  "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[tone]}`}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function TextInput({ placeholder, value, mono }: { placeholder?: string; value?: string; mono?: boolean }) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none ${mono ? "font-mono tabular" : ""}`}
    />
  );
}

function Select({ options, value }: { options: string[]; value?: string }) {
  return (
    <select
      defaultValue={value ?? options[0]}
      className="w-full appearance-none rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:border-accent/50 focus:outline-none"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EmptyTable({ title, hint, cta }: { title: string; hint: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/30 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background/60 text-accent">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="text-sm font-bold">{title}</div>
      <div className="max-w-md text-[12px] text-muted-foreground">{hint}</div>
      {cta && <PillButton variant="primary">{cta}</PillButton>}
    </div>
  );
}

function MiniStat({ label, value, delta, tone = "default", icon: Icon }: {
  label: string; value: string; delta?: string;
  tone?: "default" | "success" | "warning" | "premium" | "destructive";
  icon?: ComponentType<{ className?: string }>;
}) {
  return <StatCard label={label} value={value} tone={tone} {...(delta ? { delta } : {})} {...(Icon ? { icon: <Icon className="h-3.5 w-3.5" /> } : {})} />;
}

/* =============================================================
   LICENSE MANAGEMENT
   ============================================================= */

const LICENSE_TABS = [
  "Overview", "Keys", "Activations", "Generator", "Bulk", "Trials",
  "Renewals", "Transfers", "Audit Log", "QR Center",
] as const;

const LICENSE_PLANS = [
  { id: "trial",      label: "Trial",      period: "14 days",  seats: "1",   price: "Free",       tone: "info" as const },
  { id: "sub",        label: "Subscription", period: "Monthly", seats: "3",   price: "₹1,499/mo",  tone: "premium" as const },
  { id: "life",       label: "Lifetime",   period: "Forever",  seats: "5",   price: "₹14,999",    tone: "success" as const },
  { id: "enterprise", label: "Enterprise", period: "Annual",   seats: "∞",   price: "Custom",     tone: "premium" as const },
  { id: "whitelabel", label: "White Label",period: "Annual",   seats: "∞",   price: "Custom",     tone: "warning" as const },
];

const LICENSE_KEYS = [
  { key: "VALA-ERPX-9F2C-84KM-77AB", product: "Vala ERP Pro",  plan: "Lifetime",     status: "active",  seats: "3 / 5",  expires: "Never",       bound: "Domain · softwarevala.com" },
  { key: "VALA-CRMX-K93D-2A81-99XZ", product: "Vala CRM Cloud", plan: "Subscription", status: "active",  seats: "1 / 3",  expires: "12 Jan 2027", bound: "Device · MAC-8A:12" },
  { key: "VALA-POSX-QQ01-CC22-DE9K", product: "Vala POS Retail",plan: "Enterprise",   status: "grace",   seats: "18 / 25",expires: "18 Feb 2027", bound: "Hardware · TPM-lock" },
  { key: "VALA-HRMS-TRIA-L009-XX01", product: "Vala HRMS",     plan: "Trial",        status: "trial",   seats: "1 / 1",  expires: "in 6 days",   bound: "IP · 103.24.—" },
  { key: "VALA-BANQ-WHIT-ELBL-3388", product: "Vala Banquet",   plan: "White Label",  status: "revoked", seats: "0 / ∞",  expires: "—",           bound: "Reseller · Aurora Systems" },
];

const STATUS_TONE = {
  active:  "success" as const,
  grace:   "warning" as const,
  trial:   "info"    as const,
  revoked: "danger"  as const,
  expired: "danger"  as const,
};

export function LicenseSection() {
  const [tab, setTab] = useState<typeof LICENSE_TABS[number]>("Overview");

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Licensing · Enterprise"
        title="License Management"
        description="End-to-end control over keys, activations, device/domain/hardware binding, trials, renewals, transfers and audit logs — for every product on the marketplace."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><FileDown className="h-3.5 w-3.5" /> Export CSV</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Generate Key</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <MiniStat label="Active Keys"  value="12,847" delta="+318 this week" tone="success" icon={KeyRound} />
        <MiniStat label="In Trial"     value="1,204"                          tone="premium" icon={Timer} />
        <MiniStat label="Expiring 30d" value="486"    delta="renewal risk"    tone="warning" icon={AlertTriangle} />
        <MiniStat label="Revoked"      value="72"                             tone="destructive" icon={Ban} />
        <MiniStat label="Activations"  value="38,912"                         tone="success" icon={CheckCircle2} />
        <MiniStat label="Verification" value="99.98%" delta="last 24h SLA"    tone="premium" icon={ShieldCheck} />
      </div>

      <SubNav items={[...LICENSE_TABS]} active={tab} onChange={(v) => setTab(v as any)} />

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {LICENSE_PLANS.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <Chip tone={p.tone}>{p.label}</Chip>
                  <div className="mt-3 text-2xl font-bold">{p.price}</div>
                  <div className="text-[11px] text-muted-foreground">{p.period} · {p.seats} seats</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60 text-accent">
                  <KeyRound className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-[12px]">
                {[
                  "Online + Offline verification",
                  "Device / Domain / Hardware lock",
                  "One-click renewal & transfer",
                  "QR-based activation",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {f}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <PillButton variant="ghost">Configure</PillButton>
                <PillButton variant="primary">Issue Key</PillButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Keys" && (
        <>
          <TableToolbar title="License Keys" count={LICENSE_KEYS.length} extraActions={["export", "import"]} />
          <div className="glass overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[1.4fr_1fr_.7fr_.7fr_.8fr_.9fr_auto] items-center gap-3 border-b border-border bg-background/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div>Key</div><div>Product</div><div>Plan</div><div>Status</div><div>Seats</div><div>Binding · Expiry</div><div className="text-right">Actions</div>
            </div>
            {LICENSE_KEYS.map((k) => (
              <div key={k.key} className="grid grid-cols-[1.4fr_1fr_.7fr_.7fr_.8fr_.9fr_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-[12px] hover:bg-white/[0.03]">
                <div className="flex items-center gap-2 font-mono text-[11px] tabular">
                  <button title="Copy" className="grid h-6 w-6 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground hover:text-accent">
                    <Copy className="h-3 w-3" />
                  </button>
                  <span className="truncate">{k.key}</span>
                </div>
                <div className="truncate font-semibold">{k.product}</div>
                <div>{k.plan}</div>
                <div><Chip tone={STATUS_TONE[k.status as keyof typeof STATUS_TONE]}>{k.status}</Chip></div>
                <div className="font-mono tabular text-muted-foreground">{k.seats}</div>
                <div className="truncate text-[11px] text-muted-foreground">{k.bound}<br /><span className="text-foreground">{k.expires}</span></div>
                <div className="flex justify-end"><RowActions ids={["view","edit","duplicate","archive","delete"]} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "Activations" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Recent Activations</h3>
              <PillButton variant="ghost">Live tail</PillButton>
            </div>
            <div className="divide-y divide-border/60">
              {[
                { key: "VALA-ERPX-9F2C-…", device: "MacBook Pro · MAC-8A:12", ip: "103.24.11.—", loc: "Mumbai, IN",   time: "2m ago", ok: true },
                { key: "VALA-CRMX-K93D-…", device: "Chrome · Win 11 · TPM",   ip: "182.71.9.—",  loc: "Delhi, IN",    time: "9m ago", ok: true },
                { key: "VALA-POSX-QQ01-…", device: "Ubuntu 22.04",             ip: "78.24.—",      loc: "Berlin, DE",   time: "22m ago",ok: false },
                { key: "VALA-HRMS-TRIA-…", device: "iPad Pro",                 ip: "49.36.—",      loc: "Bangalore, IN",time: "1h ago", ok: true },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] tabular">{r.key}</div>
                    <div className="text-[11px] text-muted-foreground">{r.device} · {r.loc} · <span className="font-mono">{r.ip}</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground">{r.time}</span>
                    {r.ok
                      ? <Chip tone="success"><CheckCircle2 className="h-3 w-3" /> ok</Chip>
                      : <Chip tone="danger"><XCircle className="h-3 w-3" /> blocked</Chip>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-3 text-sm font-bold">Binding Policy</div>
            <div className="space-y-3">
              {[
                { l: "Device Binding",   icon: Smartphone },
                { l: "Domain Binding",   icon: Globe2 },
                { l: "Hardware Lock",    icon: Cpu },
                { l: "IP Whitelist",     icon: Signal },
                { l: "TPM / Secure Boot",icon: ShieldCheck },
                { l: "Fingerprint Hash", icon: Fingerprint },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-[12px]"><r.icon className="h-3.5 w-3.5 text-accent" /> {r.l}</div>
                  <Switch on />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "Generator" && <LicenseGeneratorPanel />}

      {tab === "Bulk" && (
        <EmptyTable title="No bulk jobs running" hint="Queue up to 100,000 keys per job. Auto-CSV export, resellers assignment and idempotent retries are supported." cta="Start bulk job" />
      )}

      {tab === "Trials" && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { l: "Trial length",         v: "14 days" },
            { l: "Extend limit",         v: "1 × 7 days" },
            { l: "Card required",        v: "No" },
            { l: "Auto-convert to Paid", v: "Enabled" },
            { l: "Feature limitations",  v: "Watermark, 100 records" },
            { l: "Email cadence",        v: "Day 0 · 3 · 10 · 14" },
          ].map((r) => (
            <Card key={r.l}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{r.l}</div>
              <div className="mt-2 text-lg font-bold">{r.v}</div>
              <button className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent hover:text-cyan-glow">Configure →</button>
            </Card>
          ))}
        </div>
      )}

      {tab === "Renewals" && (
        <div className="grid gap-3">
          {[
            { p: "Vala ERP Pro", act: "Renew", tone: "success" as const, i: Repeat,       hint: "1-click yearly renewal with 15% loyalty discount." },
            { p: "Vala CRM Cloud", act: "Upgrade", tone: "premium" as const, i: ArrowUpRight, hint: "Move Subscription → Enterprise, keep seats and history." },
            { p: "Vala HRMS", act: "Downgrade", tone: "warning" as const, i: ArrowDownRight, hint: "Enterprise → Team, pro-rate refund automatically." },
            { p: "Vala Banquet", act: "Transfer", tone: "info" as const, i: Send, hint: "Reassign key to a new owner via email verification." },
            { p: "Vala POS Retail", act: "Reset", tone: "warning" as const, i: RotateCcw, hint: "Clear device bindings, keep the key and seats intact." },
            { p: "Vala Restaurant", act: "Revoke", tone: "danger" as const, i: Ban, hint: "Immediate revocation with audit trail and email notice." },
          ].map((r) => (
            <div key={r.p} className="glass flex items-center justify-between rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60 text-accent"><r.i className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-bold">{r.p} · <Chip tone={r.tone}>{r.act}</Chip></div>
                  <div className="text-[11px] text-muted-foreground">{r.hint}</div>
                </div>
              </div>
              <PillButton variant="ghost">Run {r.act}</PillButton>
            </div>
          ))}
        </div>
      )}

      {tab === "Transfers" && (
        <EmptyTable title="No pending transfers" hint="Transfers require email verification from both parties and are recorded in the audit log with IP + device fingerprint." cta="New transfer" />
      )}

      {tab === "Audit Log" && (
        <Card>
          <div className="divide-y divide-border/60">
            {[
              { t: "Key generated",  who: "boss@softwarevala.com", meta: "VALA-ERPX-9F2C-… · Lifetime · 5 seats", tone: "success" as const, i: Plus },
              { t: "Key activated",  who: "user@byteforge.io",     meta: "MAC-8A:12 · Mumbai, IN",                 tone: "info" as const,    i: CheckCircle2 },
              { t: "Seat added",     who: "boss@softwarevala.com", meta: "3 → 5 seats",                            tone: "premium" as const, i: Users },
              { t: "Renewal charged",who: "billing",                meta: "₹14,999 · Razorpay",                     tone: "success" as const, i: Repeat },
              { t: "Transfer accepted", who: "aurora@partner.io", meta: "from boss@softwarevala.com",              tone: "info" as const,    i: Send },
              { t: "Revocation",     who: "security",               meta: "Reason: charge-back",                    tone: "danger" as const,  i: Ban },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><r.i className="h-3.5 w-3.5" /></div>
                  <div>
                    <div className="text-[13px] font-bold">{r.t}</div>
                    <div className="text-[11px] text-muted-foreground">{r.who} · {r.meta}</div>
                  </div>
                </div>
                <Chip tone={r.tone}>logged</Chip>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "QR Center" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 text-sm font-bold">License QR Code</div>
            <div className="flex items-center gap-4">
              <div className="grid h-40 w-40 place-items-center rounded-2xl border border-border bg-[repeating-conic-gradient(oklch(0.8_0.13_192/0.85)_0_25%,transparent_0_50%)_50%/16px_16px]">
                <QrCode className="h-16 w-16 text-background" />
              </div>
              <div className="space-y-2 text-[12px]">
                <div><span className="text-muted-foreground">Key</span> <div className="font-mono">VALA-ERPX-9F2C-84KM-77AB</div></div>
                <div><span className="text-muted-foreground">Scan URL</span> <div className="font-mono text-accent">svala.co/l/9f2c</div></div>
                <div className="flex gap-2 pt-1"><PillButton variant="ghost">Download PNG</PillButton><PillButton variant="ghost">Print sheet</PillButton></div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><ScanLine className="h-4 w-4 text-accent" /> QR Scanner</div>
            <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-border bg-background/40 text-[12px] text-muted-foreground">
              Aim your camera or drop a QR image
            </div>
            <PillButton variant="primary">Open scanner</PillButton>
          </Card>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   LICENSE GENERATOR — premium panel
   ============================================================= */

function HardwareBindingWizard() {
  const [enabled, setEnabled] = useState(true);
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<Record<string, boolean>>({
    "CPU serial (Cpu-ID)": true,
    "Motherboard UUID":    true,
    "Primary MAC address": true,
    "Disk serial (root)":  false,
    "TPM 2.0 attestation": false,
    "OS install ID":       false,
  });
  const [strict, setStrict] = useState(true);
  const [grace, setGrace] = useState("7 days");

  const active = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
  const fingerprint = pseudoHash("hwb|" + active.join("|")).slice(0, 40).toUpperCase();
  const fpBlocks = fingerprint.match(/.{1,8}/g) ?? [];
  const risk = active.length >= 3 ? "Strong" : active.length === 2 ? "Balanced" : "Weak";
  const riskTone = active.length >= 3 ? "success" : active.length === 2 ? "info" : "warning";

  const steps = ["Signals", "Policy", "Fallback", "Preview"] as const;

  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.85 0.16 92 / 0.5), transparent 70%)" }}
      />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-premium">
              Optional · Hardware Binding Wizard
            </div>
            <div className="mt-1 text-sm font-bold">Tie this key to specific device identifiers</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{enabled ? "On" : "Off"}</span>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? "bg-gradient-to-r from-premium to-warning" : "bg-secondary"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-3 flex items-center gap-1.5">
          {steps.map((s, i) => {
            const done = i < step, current = i === step;
            return (
              <button
                key={s}
                onClick={() => enabled && setStep(i)}
                disabled={!enabled}
                className={`flex flex-1 items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  current ? "border-premium/50 bg-premium/10 text-premium"
                  : done ? "border-success/40 bg-success/10 text-success"
                  : "border-border bg-background/40 text-muted-foreground"
                } disabled:opacity-40`}
              >
                <span className="grid h-4 w-4 place-items-center rounded-full border border-current text-[9px]">
                  {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </span>
                {s}
              </button>
            );
          })}
        </div>

        <div className={`grid gap-3 ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
          {step === 0 && (
            <div className="grid gap-1.5">
              <div className="text-[11px] text-muted-foreground">Pick signals combined into a per-device fingerprint. More signals = harder to spoof, less portable.</div>
              {Object.keys(sources).map((s) => (
                <label key={s} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
                  <span className="inline-flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-premium" />{s}
                  </span>
                  <input
                    type="checkbox"
                    checked={!!sources[s]}
                    onChange={(e) => setSources({ ...sources, [s]: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[oklch(0.85_0.16_92)]"
                  />
                </label>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-2 text-[12px]">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div>
                  <div className="font-semibold">Strict match</div>
                  <div className="text-[11px] text-muted-foreground">All chosen signals must match, or activation fails.</div>
                </div>
                <button onClick={() => setStrict(!strict)} className={`h-5 w-9 rounded-full ${strict ? "bg-gradient-to-r from-primary to-accent" : "bg-secondary"} relative`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${strict ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
              <Field label="Grace period after hardware change">
                <Select options={["No grace","24 hours","7 days","30 days"]} value={grace} />
              </Field>
              <Field label="Max activations per key">
                <Select options={["1 device","2 devices","3 devices","5 devices","10 devices"]} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-1.5 text-[12px]">
              <div className="text-[11px] text-muted-foreground">If hardware changes (motherboard swap, disk replacement…), what happens?</div>
              {[
                { l: "Auto-transfer with one-time OTP",       tone: "success" as const, on: true  },
                { l: "Notify buyer & support",                tone: "info" as const,    on: true  },
                { l: "Auto-freeze until manual review",       tone: "warning" as const, on: false },
                { l: "Fallback to online-only mode",          tone: "info" as const,    on: false },
                { l: "Auto-revoke and block reuse",           tone: "danger" as const,  on: false },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <Chip tone={r.tone}>{r.tone === "danger" ? "Revoke" : r.tone === "warning" ? "Freeze" : "Allow"}</Chip>
                    {r.l}
                  </div>
                  <Switch on={r.on} />
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="rounded-xl border border-premium/30 bg-gradient-to-br from-premium/[0.06] via-background/40 to-background/40 p-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-premium">
                  <Fingerprint className="h-3.5 w-3.5" /> Device fingerprint (preview)
                </div>
                <Chip tone={riskTone}>{risk}</Chip>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {fpBlocks.map((b, i) => (
                  <span key={i} className="rounded-md border border-border bg-background/70 px-1.5 py-1 font-mono text-[11px] tabular text-premium">
                    {b}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-md border border-border bg-background/40 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Signals</div>
                  <div className="mt-0.5 font-mono tabular">{active.length}/{Object.keys(sources).length}</div>
                </div>
                <div className="rounded-md border border-border bg-background/40 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Match</div>
                  <div className="mt-0.5">{strict ? "Strict" : "Any 1 of N"}</div>
                </div>
                <div className="rounded-md border border-border bg-background/40 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Grace</div>
                  <div className="mt-0.5">{grace}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">Step {step + 1} of {steps.length}</div>
          <div className="flex gap-2">
            <PillButton variant="ghost" onClick={() => setStep(Math.max(0, step - 1))}>Back</PillButton>
            {step < steps.length - 1 ? (
              <PillButton variant="primary" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Next</PillButton>
            ) : (
              <PillButton variant="primary">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Apply binding</span>
              </PillButton>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function LicenseGeneratorPanel() {
  const [prefix, setPrefix] = useState("VALA-ERPX");
  const [format, setFormat] = useState("XXXX-XXXX-XXXX-XXXX");
  const [preview, setPreview] = useState("VALA-ERPX-9F2C-84KM-77AB");

  function roll() {
    const seg = () =>
      Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
    if (format === "Hex-32") {
      setPreview(
        Array.from({ length: 8 })
          .map(() => Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0"))
          .join(""),
      );
    } else if (format === "UUID-v4") {
      const rnd = crypto.getRandomValues(new Uint8Array(16));
      rnd[6] = ((rnd[6] ?? 0) & 0x0f) | 0x40;
      rnd[8] = ((rnd[8] ?? 0) & 0x3f) | 0x80;
      const hex = Array.from(rnd).map((b) => b.toString(16).padStart(2, "0")).join("");
      setPreview(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase());
    } else if (format === "JWT signed") {
      setPreview("eyJhbGciOiJIUzI1NiJ9." + Math.random().toString(36).slice(2, 22) + "." + Math.random().toString(36).slice(2, 22));
    } else {
      setPreview(`${prefix}-${seg()}-${seg()}-${seg()}`);
    }
  }

  const segments = preview.includes(".") ? preview.split(".") : preview.split("-");
  const entropy = Math.min(100, preview.replace(/[^a-zA-Z0-9]/g, "").length * 4);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      {/* KEY GENERATOR */}
      <Card className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 right-[-30%] h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.80 0.13 192 / 0.55), transparent 70%)" }}
        />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                License · Key Generator
              </div>
              <div className="mt-1 text-sm font-bold">Issue a signed, bindable license key</div>
            </div>
            <Chip tone="premium"><Sparkles className="h-3 w-3" /> Enterprise</Chip>
          </div>

          {/* PREMIUM KEY PREVIEW */}
          <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-background/90 to-background/60 p-4 shadow-[0_20px_60px_-30px_oklch(0.80_0.13_192/0.5),inset_0_1px_0_oklch(1_0_0/0.05)]">
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <KeyRound className="h-3 w-3 text-accent" /> Preview key
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={roll}
                  title="Regenerate"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:text-accent"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(preview)}
                  title="Copy"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:text-accent"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  title="QR"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:text-accent"
                >
                  <QrCode className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {segments.map((s, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-background/80 px-2.5 py-2 font-mono text-[15px] font-bold tabular text-accent shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]"
                >
                  {s || "—"}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-3 text-[11px]">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Entropy</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-success/60 to-success"
                      style={{ width: `${entropy}%` }}
                    />
                  </div>
                  <span className="font-mono tabular text-success">{entropy}%</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Signature</div>
                <div className="mt-1 inline-flex items-center gap-1 text-success">
                  <ShieldCheck className="h-3 w-3" /> Ed25519
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Length</div>
                <div className="mt-1 font-mono tabular">{preview.length} chars</div>
              </div>
            </div>
          </div>

          {/* CONFIG */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Product"><Select options={["Vala ERP Pro","Vala CRM Cloud","Vala POS Retail","Vala HRMS","Vala Banquet"]} /></Field>
            <Field label="Plan"><Select options={["Trial","Subscription","Lifetime","Enterprise","White Label"]} /></Field>
            <Field label="Seats"><TextInput value="5" mono /></Field>
            <Field label="Duration"><Select options={["14 days","1 month","1 year","3 years","Lifetime"]} /></Field>
            <Field label="Prefix">
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-[12px] tabular focus:border-accent/50 focus:outline-none"
              />
            </Field>
            <Field label="Format">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:border-accent/50 focus:outline-none"
              >
                {["XXXX-XXXX-XXXX-XXXX","Hex-32","UUID-v4","JWT signed"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Binding"><Select options={["Device","Domain","Hardware","IP","Multi"]} /></Field>
            <Field label="Mode"><Select options={["Online + Offline","Online only","Offline only"]} /></Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="info"><Fingerprint className="h-3 w-3" /> device-bound</Chip>
            <Chip tone="success"><ShieldCheck className="h-3 w-3" /> signed</Chip>
            <Chip tone="premium"><Timer className="h-3 w-3" /> auto-renew</Chip>
            <div className="ml-auto flex gap-2">
              <PillButton variant="ghost">Save template</PillButton>
              <PillButton variant="primary">Generate & Issue</PillButton>
            </div>
          </div>
        </div>
      </Card>

      {/* BULK */}
      <div className="space-y-4">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Bulk Generation</div>
              <div className="mt-1 text-sm font-bold">Queue up to 100,000 keys per job</div>
            </div>
            <Chip tone="premium">Async</Chip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><TextInput value="500" mono /></Field>
            <Field label="Product"><Select options={["Vala ERP Pro","Vala CRM Cloud"]} /></Field>
            <Field label="Batch tag"><TextInput value="Q1-2027-partner-batch" /></Field>
            <Field label="Assign to"><Select options={["Unassigned","Reseller: Aurora","Partner: ByteForge"]} /></Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-accent/30 bg-accent/[0.04] p-4 text-[12px]">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background/60 text-accent">
                <FileDown className="h-4 w-4" />
              </div>
              <div>
                <div className="font-bold">Drop CSV to bulk-import</div>
                <div className="text-[11px] text-muted-foreground">
                  or generate <span className="font-mono text-accent">500</span> new keys with the config on the left
                </div>
              </div>
            </div>
            <PillButton variant="ghost">Template</PillButton>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <PillButton variant="ghost">Dry-run</PillButton>
            <PillButton variant="primary">Generate Batch</PillButton>
          </div>
        </Card>

        <HardwareBindingWizard />


        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Recent batches</div>
            <PillButton variant="ghost">All jobs</PillButton>
          </div>
          <div className="divide-y divide-border/60">
            {[
              { id: "batch-2277", qty: 500,  prod: "Vala ERP Pro", state: "Completed", tone: "success" as const, when: "12m ago" },
              { id: "batch-2276", qty: 120,  prod: "Vala CRM",     state: "Running",   tone: "info" as const,    when: "just now"  },
              { id: "batch-2275", qty: 10000,prod: "Vala HRMS",    state: "Queued",    tone: "warning" as const, when: "1h ago"    },
            ].map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2.5 text-[12px]">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[11px] tabular text-accent">{b.id}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{b.prod} · {b.qty.toLocaleString()} keys · {b.when}</div>
                </div>
                <Chip tone={b.tone}>{b.state}</Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =============================================================
   DOWNLOAD CENTER
   ============================================================= */

const DL_TABS = ["Files", "Versions", "Mirrors", "Tokens", "Analytics", "Integrity"] as const;

const FILE_VERSIONS = ["4.2.0 · Latest", "4.1.4 · Stable", "4.1.0 · LTS", "5.0.0-beta.2 · Beta"];

const FILES = [
  { name: "vala-erp-pro-4.2.0-setup.exe", size: "218 MB", os: "Windows", ver: "4.2.0", channel: "Latest" as const, dl: "18,410", integrity: "OK", state: "ready" as const, sha: "9f4a1b…c21e", ttl: "10m" },
  { name: "vala-erp-pro-4.2.0.dmg",        size: "241 MB", os: "macOS",   ver: "4.2.0", channel: "Latest" as const, dl: "5,208",  integrity: "OK", state: "ready" as const, sha: "82c3ee…d711", ttl: "10m" },
  { name: "vala-erp-pro-4.2.0.AppImage",   size: "236 MB", os: "Linux",   ver: "4.2.0", channel: "Latest" as const, dl: "1,842",  integrity: "OK", state: "signing" as const, sha: "1b8a…f019", ttl: "—"   },
  { name: "vala-crm-cloud-3.7.1.zip",      size: "68 MB",  os: "Web",     ver: "3.7.1", channel: "Stable" as const, dl: "12,004", integrity: "OK", state: "ready" as const, sha: "44de…9a02", ttl: "1h" },
  { name: "vala-hrms-2.4.0.apk",           size: "42 MB",  os: "Android", ver: "2.4.0", channel: "Beta"   as const, dl: "3,566",  integrity: "Warn",state: "warn"  as const, sha: "77ab…ccff", ttl: "5m" },
];

const CHANNEL_TONE: Record<string, "success" | "premium" | "info" | "warning" | "danger"> = {
  Latest: "success", Stable: "premium", LTS: "info", Beta: "warning", Deprecated: "danger",
};

export function DownloadsSection() {
  const [tab, setTab] = useState<typeof DL_TABS[number]>("Files");

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Download Center · Enterprise"
        title="Secure Downloads"
        description="Signed URLs, CDN mirrors, per-version integrity, token limits, geo-restrictions and full analytics for every product."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> CDN status</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Upload File</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <MiniStat label="Total Downloads" value="1.2M"    delta="+12.4% MoM"   tone="success" icon={Download} />
        <MiniStat label="Active Files"    value="847"                          tone="premium" icon={HardDrive} />
        <MiniStat label="Mirrors"         value="8"       delta="Global"       tone="premium" icon={Cloud} />
        <MiniStat label="Active Tokens"   value="9,441"                        tone="success" icon={KeyRound} />
        <MiniStat label="Failed 24h"      value="0.04%"                        tone="warning" icon={AlertTriangle} />
        <MiniStat label="Integrity OK"    value="100%"                         tone="success" icon={ShieldCheck} />
      </div>

      <SubNav items={[...DL_TABS]} active={tab} onChange={(v) => setTab(v as any)} />

      {tab === "Files" && (
        <>
          <TableToolbar title="Files" count={FILES.length} extraActions={["publish", "export"]} />
          <div className="glass overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[2.2fr_.7fr_1.1fr_.6fr_.9fr_1fr_auto] items-center gap-3 border-b border-border bg-background/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div>File · Signature</div>
              <div>OS</div>
              <div>Version · Channel</div>
              <div>Size</div>
              <div>Downloads</div>
              <div>Secure state</div>
              <div className="text-right">Actions</div>
            </div>
            {FILES.map((f) => {
              const OsIcon =
                f.os === "Linux" ? Server :
                f.os === "Android" ? Smartphone :
                f.os === "Web" ? Cloud : Monitor;
              const state =
                f.state === "ready"
                  ? { label: "Signed URL ready", tone: "success" as const, dot: "bg-success" }
                  : f.state === "signing"
                  ? { label: "Generating URL", tone: "warning" as const, dot: "bg-warning animate-pulse" }
                  : { label: "Integrity warn", tone: "danger" as const, dot: "bg-destructive" };
              return (
                <div key={f.name} className="grid grid-cols-[2.2fr_.7fr_1.1fr_.6fr_.9fr_1fr_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-[12px] hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background/60 text-accent">
                        <HardDrive className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{f.name}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          <ShieldCheck className="mr-0.5 inline h-2.5 w-2.5 text-success" />
                          sha256: {f.sha} · signed · SoftwareVala Root CA
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <OsIcon className="h-3.5 w-3.5" /> {f.os}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={`${f.ver} · ${f.channel}`}
                      className="max-w-[150px] appearance-none rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] tabular text-foreground focus:border-accent/50 focus:outline-none"
                    >
                      {FILE_VERSIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <Chip tone={CHANNEL_TONE[f.channel] ?? "neutral"}>{f.channel}</Chip>
                  </div>
                  <div className="text-muted-foreground">{f.size}</div>
                  <div>
                    <div className="font-mono tabular font-bold">{f.dl}</div>
                    <div className="text-[10px] text-muted-foreground">lifetime</div>
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
                      <Chip tone={state.tone}>{state.label}</Chip>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">TTL {f.ttl} · Ed25519</div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Copy signed URL"
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground hover:text-accent"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Download"
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground hover:text-accent"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <RowActions ids={["view","edit","duplicate","archive","delete"]} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "Versions" && (
        <div className="grid gap-3">
          {[
            { v: "4.2.0", tag: "Latest",     when: "2 days ago",  notes: "Perf +18%, tax engine, offline sync",  tone: "success" as const },
            { v: "4.1.4", tag: "Stable",     when: "3 weeks ago", notes: "Security patch — CVE-2027-1288",       tone: "premium" as const },
            { v: "4.1.0", tag: "LTS",        when: "4 months ago",notes: "Long-term support until 2029",         tone: "info" as const },
            { v: "5.0.0-beta.2", tag: "Beta",when: "yesterday",   notes: "AI copilot preview, new PDP renderer", tone: "warning" as const },
            { v: "3.9.7", tag: "Deprecated", when: "1 year ago",  notes: "Sunset 2028-01-01",                    tone: "danger" as const },
          ].map((r) => (
            <div key={r.v} className="glass flex items-center justify-between rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60 text-accent font-mono text-[11px] font-bold">{r.v.split("-")[0]}</div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">v{r.v} <Chip tone={r.tone}>{r.tag}</Chip></div>
                  <div className="text-[11px] text-muted-foreground">Released {r.when} · {r.notes}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <PillButton variant="ghost">Changelog</PillButton>
                <PillButton variant="primary">Download</PillButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Mirrors" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { r: "Global CDN",   loc: "Cloudflare · 320 PoPs", up: "99.99%", tone: "success" as const },
            { r: "India",        loc: "Mumbai · Delhi",         up: "99.99%", tone: "success" as const },
            { r: "US",           loc: "NYC · SF · Dallas",      up: "99.97%", tone: "success" as const },
            { r: "EU",           loc: "Frankfurt · Amsterdam",   up: "99.98%", tone: "success" as const },
            { r: "APAC",         loc: "Singapore · Tokyo",      up: "99.96%", tone: "success" as const },
            { r: "MENA",         loc: "Dubai",                  up: "99.90%", tone: "warning" as const },
            { r: "LATAM",        loc: "São Paulo",              up: "99.85%", tone: "warning" as const },
            { r: "Origin Fallback", loc: "AWS S3 · ap-south-1", up: "100%",   tone: "premium" as const },
          ].map((m) => (
            <Card key={m.r}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">{m.r}</div>
                <Chip tone={m.tone}>{m.up}</Chip>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{m.loc}</div>
              <div className="mt-3 flex gap-2"><PillButton variant="ghost">Test</PillButton><PillButton variant="ghost">Purge</PillButton></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Tokens" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Download Token Policy</div>
            <PillButton variant="primary">New token</PillButton>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Token TTL"><Select options={["5 minutes","30 minutes","1 hour","24 hours","7 days"]} /></Field>
            <Field label="Max downloads per token"><TextInput value="3" mono /></Field>
            <Field label="Bind to IP"><Select options={["Off","Same /24","Exact"]} /></Field>
            <Field label="Geo allow-list"><TextInput value="IN, US, EU, SG" /></Field>
            <Field label="Rate limit"><TextInput value="10 / minute" /></Field>
            <Field label="Signing algorithm"><Select options={["HMAC-SHA256","RS256","Ed25519"]} /></Field>
          </div>
        </Card>
      )}

      {tab === "Analytics" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { l: "Downloads · 30d",  v: "184,207", d: "+12.4% vs prev", tone: "success" as const, i: Download },
              { l: "Success rate",     v: "99.96%",  d: "0.04% failed",   tone: "success" as const, i: CheckCircle2 },
              { l: "P50 speed",        v: "84 MB/s", d: "Global median",  tone: "premium" as const, i: Zap },
              { l: "Avg completion",   v: "3.2s",    d: "TTFB → done",    tone: "premium" as const, i: Timer },
            ].map((s) => (
              <Card key={s.l}>
                <div className="flex items-start justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.l}</div>
                  <div className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-background/60 text-accent">
                    <s.i className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 font-mono text-2xl font-bold tabular">{s.v}</div>
                <div className="text-[10px] text-muted-foreground">{s.d}</div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold">Downloads (last 30 days)</div>
                <div className="flex gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">30d</span>
                  <span className="rounded-full px-2 py-0.5">90d</span>
                  <span className="rounded-full px-2 py-0.5">1y</span>
                </div>
              </div>
              <div className="flex h-40 items-end gap-1.5">
                {Array.from({ length: 30 }).map((_, i) => {
                  const h = 20 + ((i * 43) % 78);
                  return (
                    <div key={i} className="group relative flex-1">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary/40 to-accent/80 transition-opacity group-hover:opacity-100"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>Jun 15</span><span>Jun 30</span><span>Jul 15</span>
              </div>
            </Card>

            <Card>
              <div className="mb-3 text-sm font-bold">Top files</div>
              <div className="space-y-1.5">
                {FILES.slice(0, 5).map((f, i) => {
                  const pct = 100 - i * 14;
                  return (
                    <div key={f.name} className="rounded-lg bg-background/40 px-3 py-2 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{f.name}</span>
                        <span className="font-mono tabular text-accent">{f.dl}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-background/60">
                        <div className="h-full bg-gradient-to-r from-primary/40 to-accent/80" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="mb-3 text-sm font-bold">By OS</div>
              {[
                { l: "Windows", v: 62, i: Monitor },
                { l: "macOS",   v: 21, i: Monitor },
                { l: "Linux",   v: 9,  i: Server },
                { l: "Android", v: 6,  i: Smartphone },
                { l: "Web",     v: 2,  i: Cloud },
              ].map((r) => (
                <div key={r.l} className="mb-2 flex items-center gap-2 text-[12px]">
                  <r.i className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="w-16">{r.l}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                    <div className="h-full bg-gradient-to-r from-primary/40 to-accent/80" style={{ width: `${r.v}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono tabular text-muted-foreground">{r.v}%</span>
                </div>
              ))}
            </Card>
            <Card>
              <div className="mb-3 text-sm font-bold">Top regions</div>
              {[
                { l: "India",   v: "72,120" },
                { l: "USA",     v: "38,904" },
                { l: "Germany", v: "12,401" },
                { l: "UAE",     v: "8,204"  },
                { l: "Brazil",  v: "5,908"  },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between border-b border-border/60 py-1.5 text-[12px] last:border-0">
                  <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3 w-3 text-accent" /> {r.l}</span>
                  <span className="font-mono tabular text-accent">{r.v}</span>
                </div>
              ))}
            </Card>
            <Card>
              <div className="mb-3 text-sm font-bold">Token health</div>
              {[
                { l: "Signed URLs issued 24h", v: "12,847" },
                { l: "Avg TTL used",           v: "6m 12s" },
                { l: "IP-mismatch blocked",    v: "34" },
                { l: "Geo-blocked",            v: "12" },
                { l: "Expired before use",     v: "3.1%" },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between border-b border-border/60 py-1.5 text-[12px] last:border-0">
                  <span className="text-muted-foreground">{r.l}</span>
                  <span className="font-mono tabular">{r.v}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Per-version trends · Per-mirror latency · Success/failure breakdown */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold">By version · last 30d</div>
                <Chip tone="info">7 tracked</Chip>
              </div>
              <div className="space-y-2.5">
                {[
                  { v: "v4.2.1", ch: "stable", dl: 84120, share: 100, tone: "success" as const, trend: [30,42,55,60,58,66,70,74,78,82,86,90] },
                  { v: "v4.2.0", ch: "stable", dl: 42890, share: 51,  tone: "info"    as const, trend: [60,58,54,50,46,42,40,36,32,30,28,26] },
                  { v: "v4.3.0-beta", ch: "beta", dl: 18240, share: 22, tone: "premium" as const, trend: [4,6,8,10,15,22,28,35,40,48,55,60] },
                  { v: "v3.9.7-LTS", ch: "LTS",  dl: 12002, share: 14, tone: "info"    as const, trend: [22,22,23,24,24,23,22,22,21,22,22,23] },
                  { v: "v4.1.9",   ch: "legacy", dl: 3820,  share: 5,  tone: "warning" as const, trend: [12,10,9,8,7,6,5,5,4,4,3,3] },
                ].map((r) => {
                  const max = Math.max(...r.trend);
                  return (
                    <div key={r.v} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <div className="inline-flex items-center gap-1.5">
                          <GitBranch className="h-3 w-3 text-accent" />
                          <span className="font-mono tabular">{r.v}</span>
                          <Chip tone={r.tone}>{r.ch}</Chip>
                        </div>
                        <div className="font-mono tabular text-accent">{r.dl.toLocaleString()}</div>
                      </div>
                      <div className="mt-1.5 flex h-6 items-end gap-0.5">
                        {r.trend.map((t, i) => (
                          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-accent/70" style={{ height: `${(t / max) * 100}%` }} />
                        ))}
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-background/60">
                        <div className="h-full bg-gradient-to-r from-primary/50 to-accent" style={{ width: `${r.share}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold">Per-mirror latency · 24h</div>
                <Chip tone="success"><Signal className="h-3 w-3" /> Healthy</Chip>
              </div>
              <div className="space-y-2">
                {[
                  { m: "Mumbai · Primary",  ms: 42,  ok: 99.98, pkt: 0.02, tone: "success" as const },
                  { m: "Singapore · Edge",  ms: 78,  ok: 99.95, pkt: 0.05, tone: "success" as const },
                  { m: "Frankfurt · Edge",  ms: 118, ok: 99.92, pkt: 0.08, tone: "success" as const },
                  { m: "Virginia · Edge",   ms: 154, ok: 99.87, pkt: 0.13, tone: "info"    as const },
                  { m: "São Paulo · Edge",  ms: 218, ok: 99.60, pkt: 0.40, tone: "warning" as const },
                  { m: "Sydney · Edge",     ms: 246, ok: 99.72, pkt: 0.28, tone: "info"    as const },
                ].map((r) => {
                  const pct = Math.min(100, (r.ms / 300) * 100);
                  const bar = r.ms < 100 ? "from-success/50 to-success" : r.ms < 200 ? "from-accent/40 to-accent" : "from-warning/40 to-warning";
                  return (
                    <div key={r.m} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <div className="inline-flex items-center gap-1.5 truncate">
                          <Cloud className="h-3 w-3 text-accent" /> <span className="truncate">{r.m}</span>
                        </div>
                        <div className="inline-flex items-center gap-2 font-mono tabular text-[11px]">
                          <span className="text-foreground">{r.ms}<span className="text-muted-foreground">ms</span></span>
                          <Chip tone={r.tone}>{r.ok}%</Chip>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background/60">
                        <div className={`h-full bg-gradient-to-r ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Packet loss {r.pkt}%</span>
                        <span>P95 {(r.ms * 1.4).toFixed(0)}ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold">Success / failure · 24h</div>
                <Chip tone="success">99.96% ok</Chip>
              </div>
              {/* Donut */}
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="relative h-24 w-24 shrink-0 rounded-full"
                  style={{ background: "conic-gradient(oklch(0.78 0.17 152) 0 359.86deg, oklch(0.82 0.16 75) 359.86deg 359.94deg, oklch(0.62 0.18 25) 359.94deg 360deg)" }}
                >
                  <div className="absolute inset-2 grid place-items-center rounded-full bg-background text-center">
                    <div>
                      <div className="font-mono text-sm font-bold tabular text-success">99.96%</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Success</div>
                    </div>
                  </div>
                </div>
                <div className="grid flex-1 gap-1 text-[11px]">
                  <div className="flex items-center justify-between rounded-md bg-background/40 px-2 py-1">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Completed</span>
                    <span className="font-mono tabular">184,133</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-background/40 px-2 py-1">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Retried & ok</span>
                    <span className="font-mono tabular">62</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-background/40 px-2 py-1">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Failed</span>
                    <span className="font-mono tabular">12</span>
                  </div>
                </div>
              </div>

              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Failure reasons</div>
              <div className="space-y-1.5 text-[12px]">
                {[
                  { l: "Signed URL expired",    v: 34, tone: "warning" as const, icon: Timer },
                  { l: "Network reset / abort", v: 22, tone: "info"    as const, icon: RefreshCw },
                  { l: "Geo-blocked",           v: 12, tone: "warning" as const, icon: Globe2 },
                  { l: "IP mismatch",           v: 8,  tone: "warning" as const, icon: ShieldAlert },
                  { l: "Checksum mismatch",     v: 2,  tone: "danger"  as const, icon: XCircle },
                ].map((r) => (
                  <div key={r.l} className="flex items-center gap-2">
                    <r.icon className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 truncate">{r.l}</span>
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-background/60">
                      <div className="h-full bg-gradient-to-r from-warning/40 to-warning" style={{ width: `${(r.v / 34) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right font-mono tabular text-muted-foreground">{r.v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}


      {tab === "Integrity" && (
        <Card>
          <div className="mb-3 text-sm font-bold">Integrity & Signing</div>
          <div className="divide-y divide-border/60">
            {[
              { l: "SHA-256 checksum published for every file", ok: true },
              { l: "GPG signature (.asc) bundled with release",  ok: true },
              { l: "Malware scan (VirusTotal · Windows Defender · ClamAV)", ok: true },
              { l: "Digital signature: SoftwareVala Root CA",   ok: true },
              { l: "Automatic tamper alert to security channel",ok: true },
              { l: "Publish only signed binaries",              ok: true },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between py-3 text-[12px]">
                <div>{r.l}</div>
                {r.ok ? <Chip tone="success"><CheckCircle2 className="h-3 w-3" /> enforced</Chip> : <Chip tone="warning">missing</Chip>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* =============================================================
   PRICING
   ============================================================= */

export function PricingSection() {
  const [tab, setTab] = useState("Plans");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Pricing · Enterprise"
        title="Pricing & Plans"
        description="Multi-currency plans, trials, EMI, coupons, gift cards, regional taxation and subscription billing controls."
        actions={<PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New plan</span></PillButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Active plans"   value="24"                             tone="success" icon={DollarSign} />
        <MiniStat label="Currencies"     value="14"                             tone="premium" icon={Globe2} />
        <MiniStat label="Active coupons" value="38"     delta="6 expiring soon" tone="warning" icon={TicketPercent} />
        <MiniStat label="MRR"            value="₹18.4L" delta="+9.2% MoM"       tone="premium" icon={TrendingUp} />
      </div>

      <SubNav items={["Plans","Trials","Coupons","Gift Cards","EMI","Currency","Tax","Regional"]} active={tab} onChange={setTab} />

      {tab === "Plans" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "Starter",     p: "₹1,499", per: "/ mo", tone: "info" as const,    feats: ["1 user","5 GB","Email support"] },
            { n: "Growth",      p: "₹4,999", per: "/ mo", tone: "success" as const, feats: ["5 users","50 GB","Priority support","API"] },
            { n: "Business",    p: "₹14,999",per: "/ mo", tone: "premium" as const, feats: ["25 users","500 GB","SLA 99.9%","SSO"] },
            { n: "Enterprise",  p: "Custom", per: "",     tone: "premium" as const, feats: ["Unlimited","On-prem/Cloud","Dedicated CSM","Audit"] },
          ].map((pl) => (
            <Card key={pl.n} className="relative overflow-hidden">
              <Chip tone={pl.tone}>{pl.n}</Chip>
              <div className="mt-3 text-3xl font-bold">{pl.p}<span className="text-sm font-normal text-muted-foreground">{pl.per}</span></div>
              <div className="mt-3 space-y-1.5 text-[12px]">
                {pl.feats.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> {f}</div>
                ))}
              </div>
              <div className="mt-4 flex gap-2"><PillButton variant="ghost">Edit</PillButton><PillButton variant="primary">Publish</PillButton></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Coupons" && (
        <div className="grid gap-3">
          {[
            { c: "LAUNCH50", d: "50% off first invoice",  u: "1,204 / 5,000", tone: "success" as const },
            { c: "DIWALI25", d: "25% off — festival",       u: "418 / 2,000",  tone: "premium" as const },
            { c: "PARTNER10", d: "10% — reseller wallet",   u: "982 / ∞",       tone: "info" as const },
            { c: "TRIAL7",   d: "Extend trial by 7 days",   u: "77 / 500",     tone: "warning" as const },
          ].map((r) => (
            <div key={r.c} className="glass flex items-center justify-between rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60 text-accent"><Percent className="h-4 w-4" /></div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold"><span className="font-mono tabular">{r.c}</span><Chip tone={r.tone}>active</Chip></div>
                  <div className="text-[11px] text-muted-foreground">{r.d} · used {r.u}</div>
                </div>
              </div>
              <RowActions ids={["view","edit","duplicate","archive","delete"]} />
            </div>
          ))}
        </div>
      )}

      {tab === "Gift Cards" && (
        <div className="grid gap-4 md:grid-cols-3">
          {[500, 1000, 5000].map((v) => (
            <Card key={v} className="relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-premium/20 blur-2xl" />
              <div className="relative">
                <Chip tone="premium"><Gift className="h-3 w-3" /> Gift Card</Chip>
                <div className="mt-3 text-3xl font-bold">₹{v.toLocaleString()}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Delivered via email · Personal note supported</div>
                <div className="mt-4 flex gap-2"><PillButton variant="ghost">Preview</PillButton><PillButton variant="primary">Issue</PillButton></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Currency" && (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {["INR ₹","USD $","EUR €","GBP £","AED د.إ","SGD S$","AUD A$","CAD C$","JPY ¥","BRL R$","ZAR R","SAR ﷼","IDR Rp","MXN $"].map((c) => (
            <div key={c} className="glass flex items-center justify-between rounded-xl p-3">
              <div className="text-sm font-bold">{c}</div>
              <Switch on />
            </div>
          ))}
        </div>
      )}

      {(tab === "Trials" || tab === "EMI" || tab === "Tax" || tab === "Regional") && (
        <Card>
          <div className="text-sm font-bold">{tab} configuration</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label={`${tab} rule name`}><TextInput placeholder={`e.g. Global default ${tab.toLowerCase()}`} /></Field>
            <Field label="Scope"><Select options={["All products","Category: ERP","Category: CRM","Custom"]} /></Field>
            <Field label="Regions"><TextInput value="Global · except: CN, RU" /></Field>
            <Field label="Status"><Select options={["Active","Draft","Paused"]} /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-2"><PillButton variant="ghost">Reset</PillButton><PillButton variant="primary">Save {tab.toLowerCase()}</PillButton></div>
        </Card>
      )}
    </div>
  );
}

/* =============================================================
   ORDERS + INVOICES
   ============================================================= */

const ORDERS = [
  { id: "SV-8842", cust: "Aurora Systems Pvt Ltd", prod: "Vala ERP Pro · Lifetime · 5 seats", amt: "₹14,999", pay: "Razorpay", status: "Paid",     tone: "success" as const },
  { id: "SV-8841", cust: "ByteForge Studios",     prod: "Vala CRM · Subscription · 3 seats",  amt: "₹4,497",  pay: "Stripe",   status: "Paid",     tone: "success" as const },
  { id: "SV-8840", cust: "Nimbus Retail LLP",     prod: "Vala POS Retail · Enterprise",       amt: "₹1,20,000",pay: "Bank",     status: "Pending",  tone: "warning" as const },
  { id: "SV-8839", cust: "Kanpur Sweets",         prod: "Vala Restaurant · Yearly",           amt: "₹19,999", pay: "PhonePe",  status: "Refunded", tone: "danger" as const },
  { id: "SV-8838", cust: "Lotus HR Consulting",   prod: "Vala HRMS · Trial → Business",       amt: "₹0",      pay: "—",        status: "Trial",    tone: "info" as const },
];

export function OrdersSection() {
  const [tab, setTab] = useState("All Orders");
  const list = useMemo(() => ORDERS, []);
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Orders & Invoicing"
        title="Orders"
        description="Order lifecycle, invoicing, proforma, credit notes, partial refunds, disputes and downloadable PDFs."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Bulk invoices</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Manual order</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <MiniStat label="Orders today"  value="184"    delta="+22 vs yesterday" tone="success" icon={ShoppingBag} />
        <MiniStat label="Revenue today" value="₹4.82L" delta="+18%"             tone="premium" icon={DollarSign} />
        <MiniStat label="Pending"       value="12"                              tone="warning" icon={Timer} />
        <MiniStat label="Refunded 30d"  value="₹28k"                            tone="warning" icon={ArrowDownRight} />
        <MiniStat label="AOV"           value="₹6,214"                          tone="premium" icon={TrendingUp} />
        <MiniStat label="Disputes"      value="2"      delta="in review"        tone="destructive" icon={ShieldAlert} />
      </div>

      <SubNav items={["All Orders","Invoices","Proforma","Credit Notes","Refunds","Disputes"]} active={tab} onChange={setTab} />

      {tab === "All Orders" && (
        <>
          <TableToolbar title="Orders" count={list.length} extraActions={["export"]} />
          <div className="glass overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[.6fr_1.2fr_1.4fr_.7fr_.7fr_.7fr_auto] items-center gap-3 border-b border-border bg-background/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div>Order</div><div>Customer</div><div>Product</div><div>Amount</div><div>Payment</div><div>Status</div><div className="text-right">Actions</div>
            </div>
            {list.map((o) => (
              <div key={o.id} className="grid grid-cols-[.6fr_1.2fr_1.4fr_.7fr_.7fr_.7fr_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-[12px] hover:bg-white/[0.03]">
                <div className="font-mono tabular text-accent">{o.id}</div>
                <div className="truncate">{o.cust}</div>
                <div className="truncate text-muted-foreground">{o.prod}</div>
                <div className="font-mono tabular font-bold">{o.amt}</div>
                <div>{o.pay}</div>
                <div><Chip tone={o.tone}>{o.status}</Chip></div>
                <div className="flex justify-end"><RowActions ids={["view","edit","duplicate","archive"]} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "Invoices" && <InvoicePreview />}

      {(tab === "Proforma" || tab === "Credit Notes" || tab === "Refunds" || tab === "Disputes") && (
        <EmptyTable
          title={`${tab} — empty`}
          hint={`When ${tab.toLowerCase()} are created, they appear here with search, filters, PDF preview and one-click download.`}
          cta={`Create ${tab.toLowerCase().replace(/s$/, "")}`}
        />
      )}
    </div>
  );
}

type InvoiceMethod = "Razorpay" | "Stripe" | "UPI" | "PayPal" | "Bank" | "Crypto";
type MethodMeta = {
  ref: string; icon: any; badge: string;
  tone: "success" | "premium" | "info";
  currency: string; symbol: string; locale: string; fx: number;
  taxMode: "gst-intra" | "gst-inter" | "vat" | "sales-tax" | "none";
  taxRate: number; region: string;
  variant: "card" | "upi" | "wallet" | "bank" | "crypto";
};

function pseudoHash(input: string): string {
  let h1 = 0x811c9dc5 >>> 0, h2 = 0xdeadbeef >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    h1 = Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35) >>> 0;
    h2 = Math.imul(h2 ^ (h2 >>> 16), 0x27d4eb2f) >>> 0;
    out += ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

function InvoicePreview() {
  const [method, setMethod] = useState<InvoiceMethod>("Razorpay");

  const methodMeta: Record<InvoiceMethod, MethodMeta> = {
    Razorpay: { ref: "pay_M9x4KqLp82BvR7", icon: CreditCard, badge: "Card · rzp", tone: "success", currency: "INR", symbol: "₹", locale: "en-IN", fx: 1, taxMode: "gst-intra", taxRate: 0.18, region: "India · Intra-state", variant: "card" },
    Stripe:   { ref: "pi_3PfXqL2eZvKYlo2C1uAbCdEf", icon: CreditCard, badge: "Card · stripe", tone: "premium", currency: "USD", symbol: "$", locale: "en-US", fx: 1 / 83, taxMode: "sales-tax", taxRate: 0.0875, region: "US · Sales tax", variant: "card" },
    UPI:      { ref: "TXN728194023114@axl", icon: QrCode, badge: "UPI intent", tone: "success", currency: "INR", symbol: "₹", locale: "en-IN", fx: 1, taxMode: "gst-intra", taxRate: 0.18, region: "India · UPI QR", variant: "upi" },
    PayPal:   { ref: "8W4527801L992134M", icon: Wallet, badge: "PayPal · EU", tone: "info", currency: "EUR", symbol: "€", locale: "en-IE", fx: 1 / 90, taxMode: "vat", taxRate: 0.20, region: "EU · VAT", variant: "wallet" },
    Bank:     { ref: "NEFT · N279-2408123044", icon: Banknote, badge: "NEFT · IMPS", tone: "info", currency: "INR", symbol: "₹", locale: "en-IN", fx: 1, taxMode: "gst-inter", taxRate: 0.18, region: "India · Inter-state", variant: "bank" },
    Crypto:   { ref: "0x8f2a…c21e · USDT-TRC20", icon: Hash, badge: "USDT · TRC20", tone: "premium", currency: "USDT", symbol: "₮", locale: "en-US", fx: 1 / 83, taxMode: "none", taxRate: 0, region: "On-chain · Untaxed", variant: "crypto" },
  };
  const m = methodMeta[method];

  const items = [
    { it: "Vala ERP Pro · Lifetime · 5 seats", hsn: "997331", q: 1, r: 14999 },
    { it: "Priority support (12 months)",       hsn: "998313", q: 1, r: 2999 },
  ];
  const subtotalINR = items.reduce((s, r) => s + r.q * r.r, 0);
  const fx = (nInr: number) => nInr * m.fx;
  const fmt = (nInr: number) =>
    `${m.symbol}${new Intl.NumberFormat(m.locale, {
      minimumFractionDigits: m.currency === "INR" ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(fx(nInr))}`;

  const taxRows: { label: string; amount: number }[] =
    m.taxMode === "gst-intra"
      ? [
          { label: "CGST 9%", amount: subtotalINR * 0.09 },
          { label: "SGST 9%", amount: subtotalINR * 0.09 },
        ]
      : m.taxMode === "gst-inter"
      ? [{ label: "IGST 18%", amount: subtotalINR * 0.18 }]
      : m.taxMode === "vat"
      ? [{ label: `VAT ${(m.taxRate * 100).toFixed(0)}%`, amount: subtotalINR * m.taxRate }]
      : m.taxMode === "sales-tax"
      ? [{ label: `Sales tax ${(m.taxRate * 100).toFixed(2)}%`, amount: subtotalINR * m.taxRate }]
      : [];
  const taxTotal = taxRows.reduce((s, r) => s + r.amount, 0);
  const grandINR = subtotalINR + taxTotal;

  // Anti-tamper deterministic document hash
  const docPayload = `INV-2027-0842|${method}|${m.ref}|${m.currency}|${fx(grandINR).toFixed(2)}`;
  const docHash = pseudoHash(docPayload);
  const shortHash = `${docHash.slice(0, 10)}…${docHash.slice(-8)}`;
  const verifyUrl = `verify.softwarevala.com/i/INV-2027-0842?h=${docHash.slice(0, 16)}`;
  const [copied, setCopied] = useState(false);

  function copyHash() {
    navigator.clipboard?.writeText(docHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  function downloadReceipt() {
    const receipt = {
      document: "INV-2027-0842",
      issued_at: "2027-07-12T14:38:00+05:30",
      issuer: { name: "Software Vala Pvt Ltd", gstin: "27AABCS1234F1Z5" },
      buyer:   { name: "Aurora Systems Pvt Ltd", gstin: "07AABCA9821K1Z9" },
      currency: m.currency,
      subtotal: Number(fx(subtotalINR).toFixed(2)),
      taxes: taxRows.map((t) => ({ label: t.label, amount: Number(fx(t.amount).toFixed(2)) })),
      total: Number(fx(grandINR).toFixed(2)),
      payment: { method, reference: m.ref, region: m.region },
      integrity: {
        algorithm: "SHA-256",
        document_hash: docHash,
        signature: "Ed25519 · SoftwareVala Root CA",
        irn: "27a8f4b0e91c…d21e",
        verify_url: `https://${verifyUrl}`,
      },
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `INV-2027-0842-verification.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* PAPER */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-white/[0.04] to-background/40 shadow-[0_30px_80px_-40px_oklch(0_0_0/0.8),inset_0_1px_0_oklch(1_0_0/0.05)]">
        <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center" aria-hidden>
          <span className="rotate-[-24deg] font-mono text-[120px] font-bold uppercase tracking-[0.2em] text-foreground/[0.025]">PAID</span>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary/60" />

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.80_0.13_192/0.6)]">SV</div>
              <div>
                <div className="text-sm font-bold">Software Vala Pvt Ltd</div>
                <div className="text-[10px] text-muted-foreground">softwarevala.com · billing@softwarevala.com</div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                <Receipt className="h-3 w-3" /> Tax Invoice
              </div>
              <div className="mt-0.5 font-mono text-xl font-bold tabular">INV-2027-0842</div>
              <div className="text-[11px] text-muted-foreground">Issued 12 Jul 2027 · Due 26 Jul 2027</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-lg border-2 border-success/60 bg-success/10 px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-success">Paid in full</div>
                <div className="font-mono text-[11px] tabular text-success/90">on 12 Jul 2027 · 14:38 IST</div>
              </div>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1.5">
              <m.icon className="h-3.5 w-3.5 text-accent" />
              <Chip tone={m.tone}>{m.badge}</Chip>
              <Chip tone="info">{m.currency}</Chip>
              <Chip tone="neutral">{m.region}</Chip>
            </div>
          </div>

          {/* UPI QR strip (only when UPI) */}
          {m.variant === "upi" && (
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-border bg-[repeating-conic-gradient(oklch(0.8_0.13_192/0.85)_0_25%,transparent_0_50%)_50%/10px_10px]">
                <QrCode className="h-10 w-10 text-background" />
              </div>
              <div className="grid gap-1 text-[11px]">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  <ScanLine className="h-3 w-3" /> Scan & pay via any UPI app
                </div>
                <div><span className="text-muted-foreground">VPA</span> <span className="font-mono tabular">softwarevala@razorpay</span></div>
                <div><span className="text-muted-foreground">Amount</span> <span className="font-mono tabular text-accent">{fmt(grandINR)}</span></div>
                <div><span className="text-muted-foreground">Ref</span> <span className="font-mono tabular">{m.ref}</span></div>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</div>
              <div className="mt-1 text-[12px] font-bold">Software Vala Pvt Ltd</div>
              <div className="text-[11px] text-muted-foreground">GSTIN 27AABCS1234F1Z5<br />PAN AABCS1234F<br />Mumbai, IN</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill to</div>
              <div className="mt-1 text-[12px] font-bold">Aurora Systems Pvt Ltd</div>
              <div className="text-[11px] text-muted-foreground">GSTIN 07AABCA9821K1Z9<br />contact@aurora.io<br />New Delhi, IN</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reference</div>
              <div className="mt-1 grid gap-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Order</span><span className="font-mono tabular">SV-8842</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gateway</span><span className="font-mono tabular">{method}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Txn</span><span className="truncate font-mono tabular text-accent" title={m.ref}>{m.ref}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-border/60">
            <div className="grid grid-cols-[2.2fr_.5fr_.7fr_.9fr_.9fr] gap-3 bg-background/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div>Item · HSN/SAC</div><div>Qty</div><div>Rate</div><div>Tax</div><div className="text-right">Amount</div>
            </div>
            {items.map((r, i) => {
              const lineTax = r.q * r.r * m.taxRate;
              return (
                <div key={i} className="grid grid-cols-[2.2fr_.5fr_.7fr_.9fr_.9fr] gap-3 border-t border-border/60 px-3 py-2.5 text-[12px]">
                  <div>
                    <div className="font-medium">{r.it}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">HSN {r.hsn}</div>
                  </div>
                  <div className="font-mono tabular">{r.q}</div>
                  <div className="font-mono tabular">{fmt(r.r)}</div>
                  <div className="font-mono tabular text-muted-foreground">{taxRows.length ? fmt(lineTax) : "—"}</div>
                  <div className="text-right font-mono tabular font-bold">{fmt(r.q * r.r + lineTax)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground">Notes</div>
              Payment received via {method}. Amounts shown in {m.currency}
              {m.currency !== "INR" && <> (base ₹{subtotalINR.toLocaleString("en-IN")} @ FX {(1 / m.fx).toFixed(2)} INR/{m.currency})</>}. Subject to Mumbai jurisdiction.
              <div className="mt-2 font-mono text-[10px]">E-invoice IRN: 27a8f4b0e91c…d21e · Signed by SoftwareVala Root CA</div>
            </div>
            <div className="space-y-1 text-[12px]">
              <Row l="Subtotal" r={fmt(subtotalINR)} />
              <Row l="Discount" r={`− ${m.symbol}0`} />
              {taxRows.length === 0 ? (
                <Row l="Tax" r="Not applicable" />
              ) : (
                taxRows.map((t) => <Row key={t.label} l={t.label} r={fmt(t.amount)} />)
              )}
              <div className="my-1 h-px bg-border" />
              <Row l={`Grand total (${m.currency})`} r={fmt(grandINR)} strong />
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-success">
                <CheckCircle2 className="h-3 w-3" /> Fully paid
              </div>
            </div>
          </div>

          {/* Anti-tamper proof */}
          <div className="mt-5 overflow-hidden rounded-xl border border-success/30 bg-gradient-to-br from-success/[0.06] via-background/40 to-background/40">
            <div className="flex items-center justify-between border-b border-success/20 px-3 py-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Anti-tamper proof
              </div>
              <Chip tone="success"><CheckCircle2 className="h-3 w-3" /> Integrity verified</Chip>
            </div>
            <div className="grid gap-3 p-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3 text-accent" />
                  <span className="text-muted-foreground">SHA-256</span>
                  <span className="truncate font-mono tabular text-foreground" title={docHash}>{shortHash}</span>
                  <button onClick={copyHash} title="Copy full hash" className="grid h-6 w-6 place-items-center rounded-md border border-border bg-background/60 text-muted-foreground hover:text-accent">
                    <Copy className="h-3 w-3" />
                  </button>
                  {copied && <span className="text-[10px] font-bold uppercase tracking-wider text-success">Copied</span>}
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 text-success" />
                  <span className="text-muted-foreground">Signature</span>
                  <span className="font-mono tabular">Ed25519 · SoftwareVala Root CA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe2 className="h-3 w-3 text-accent" />
                  <span className="text-muted-foreground">Verify</span>
                  <span className="truncate font-mono tabular text-accent">{verifyUrl}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-background/60">
                  <div className="h-full w-full bg-gradient-to-r from-success/50 via-accent/60 to-success/50" />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  Any tampering with amount, tax, party or reference will invalidate this hash on re-computation.
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <PillButton variant="ghost" onClick={copyHash}>
                  <span className="inline-flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Copy hash</span>
                </PillButton>
                <PillButton variant="primary" onClick={downloadReceipt}>
                  <span className="inline-flex items-center gap-1.5"><FileDown className="h-3.5 w-3.5" /> Verification receipt</span>
                </PillButton>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
            <div className="text-[10px] text-muted-foreground">Thank you for your business · Questions? billing@softwarevala.com</div>
            <div className="flex gap-2">
              <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> Email</span></PillButton>
              <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</span></PillButton>
              <PillButton variant="ghost" onClick={downloadReceipt}><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Verify</span></PillButton>
              <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><FileDown className="h-3.5 w-3.5" /> Download PDF</span></PillButton>
            </div>
          </div>
        </div>
      </div>

      {/* sidebar */}
      <div className="space-y-4">
        <Card>
          <div className="mb-3 text-sm font-bold">Payment method</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["Razorpay","Stripe","UPI","PayPal","Bank","Crypto"] as const).map((k) => {
              const M = methodMeta[k];
              const active = method === k;
              return (
                <button
                  key={k}
                  onClick={() => setMethod(k)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    active
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <M.icon className="h-3.5 w-3.5" /> {k}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-1 rounded-lg border border-border bg-background/40 p-2 text-[10px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-mono tabular">{m.currency}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-mono tabular">{m.taxMode.toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Region</span><span>{m.region}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Variant</span><span className="uppercase">{m.variant}</span></div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Integrity</div>
            <Chip tone="success"><ShieldCheck className="h-3 w-3" /> Locked</Chip>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="rounded-md border border-border bg-background/40 p-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Doc SHA-256</div>
              <div className="mt-0.5 break-all font-mono tabular text-foreground/90">{docHash}</div>
            </div>
            <PillButton variant="primary" onClick={downloadReceipt}>
              <span className="inline-flex items-center gap-1.5"><FileDown className="h-3.5 w-3.5" /> Download receipt (.json)</span>
            </PillButton>
          </div>
        </Card>

        <Card>
          <div className="mb-3 text-sm font-bold">Invoice options</div>
          <div className="space-y-2">
            {[
              "Auto-generate on payment",
              "Include HSN/SAC codes",
              "Attach license key",
              "Send WhatsApp copy",
              "GSTR-1 export",
              "Proforma before payment",
              "E-invoice IRN (India)",
              "Digital signature",
            ].map((r) => (
              <div key={r} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
                <div>{r}</div><Switch on />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ l, r, strong = false }: { l: string; r: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-bold" : "text-muted-foreground"}>{l}</span>
      <span className={`font-mono tabular ${strong ? "text-lg font-bold" : ""}`}>{r}</span>
    </div>
  );
}

/* =============================================================
   PAYMENTS
   ============================================================= */

const GATEWAYS = [
  { n: "Stripe",     desc: "Global cards, Apple Pay, Google Pay",   icon: CreditCard, on: true,  tone: "success" as const },
  { n: "Razorpay",   desc: "India cards, UPI, netbanking, wallets", icon: CreditCard, on: true,  tone: "success" as const },
  { n: "PayPal",     desc: "Global wallet + cards",                  icon: Wallet,     on: true,  tone: "success" as const },
  { n: "PayU",       desc: "LATAM & India",                          icon: CreditCard, on: false, tone: "warning" as const },
  { n: "PhonePe",    desc: "UPI · India",                            icon: Smartphone, on: true,  tone: "success" as const },
  { n: "Google Pay", desc: "UPI + cards",                            icon: Smartphone, on: true,  tone: "success" as const },
  { n: "Apple Pay",  desc: "iOS wallet",                             icon: Smartphone, on: true,  tone: "success" as const },
  { n: "UPI Intent", desc: "Direct VPA · QR",                        icon: QrCode,     on: true,  tone: "success" as const },
  { n: "Bank Transfer", desc: "NEFT · IMPS · SWIFT",                 icon: Banknote,   on: true,  tone: "info" as const },
  { n: "Crypto",     desc: "USDT · BTC · ETH via Coinbase Commerce", icon: Hash,       on: false, tone: "warning" as const },
  { n: "Wallet",     desc: "Vala Wallet · store credit",             icon: Wallet,     on: true,  tone: "premium" as const },
  { n: "EMI",        desc: "No-cost EMI · 3/6/9/12 mo",              icon: CreditCard, on: true,  tone: "premium" as const },
];

export function PaymentsSection() {
  const [tab, setTab] = useState("Gateways");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Payments · Enterprise"
        title="Payment Gateways"
        description="Cards, UPI, wallets, EMI, bank transfer, crypto — enable per region, route smartly, and reconcile automatically."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> PCI status</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add gateway</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <MiniStat label="Live gateways"  value="9"                          tone="success" icon={CheckCircle2} />
        <MiniStat label="Success rate"   value="98.7%" delta="24h"          tone="premium" icon={TrendingUp} />
        <MiniStat label="Auth-to-capture" value="1.4s" delta="p95"          tone="success" icon={Zap} />
        <MiniStat label="Fraud blocks"   value="42"    delta="last 24h"     tone="warning" icon={ShieldAlert} />
        <MiniStat label="Fees savings"   value="₹1.8L" delta="smart routing" tone="premium" icon={Wallet} />
      </div>

      <SubNav items={["Gateways","QR Payment","Subscriptions","Payouts","Wallets","Coupons"]} active={tab} onChange={setTab} />

      {tab === "Gateways" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {GATEWAYS.map((g) => (
            <Card key={g.n}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60 text-accent"><g.icon className="h-4 w-4" /></div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold">{g.n}<Chip tone={g.tone}>{g.on ? "live" : "not connected"}</Chip></div>
                    <div className="text-[11px] text-muted-foreground">{g.desc}</div>
                  </div>
                </div>
                <Switch on={g.on} />
              </div>
              <div className="mt-3 flex gap-2">
                <PillButton variant="ghost">Configure</PillButton>
                {g.on ? <PillButton variant="ghost">Webhooks</PillButton> : <PillButton variant="primary">Connect</PillButton>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "QR Payment" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 text-sm font-bold">Dynamic UPI QR</div>
            <div className="flex items-center gap-4">
              <div className="grid h-40 w-40 place-items-center rounded-2xl border border-border bg-[repeating-conic-gradient(oklch(0.8_0.13_192/0.85)_0_25%,transparent_0_50%)_50%/16px_16px]">
                <QrCode className="h-16 w-16 text-background" />
              </div>
              <div className="space-y-2 text-[12px]">
                <div><span className="text-muted-foreground">VPA</span> <div className="font-mono">softwarevala@razorpay</div></div>
                <div><span className="text-muted-foreground">Amount</span> <div className="font-mono text-accent">₹14,999.00</div></div>
                <div><span className="text-muted-foreground">Expires</span> <div>in 4:58</div></div>
                <div className="flex gap-2 pt-1"><PillButton variant="ghost">Regenerate</PillButton><PillButton variant="primary">Share</PillButton></div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="mb-3 text-sm font-bold">QR Payment Settings</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Merchant VPA"><TextInput value="softwarevala@razorpay" mono /></Field>
              <Field label="Merchant name"><TextInput value="Software Vala" /></Field>
              <Field label="Expiry (min)"><TextInput value="5" mono /></Field>
              <Field label="Amount lock"><Select options={["Locked","Editable"]} /></Field>
            </div>
          </Card>
        </div>
      )}

      {tab === "Subscriptions" && (
        <div className="grid gap-3">
          {[
            { p: "Vala CRM · Growth",  cy: "Monthly", who: "1,208 subs", mrr: "₹6.02L", tone: "success" as const },
            { p: "Vala ERP · Business",cy: "Yearly",  who: "412 subs",   mrr: "₹9.14L", tone: "premium" as const },
            { p: "Vala POS · Starter", cy: "Monthly", who: "3,144 subs", mrr: "₹4.71L", tone: "success" as const },
          ].map((r) => (
            <div key={r.p} className="glass flex items-center justify-between rounded-xl p-4">
              <div>
                <div className="text-sm font-bold">{r.p}</div>
                <div className="text-[11px] text-muted-foreground">{r.cy} · {r.who}</div>
              </div>
              <div className="flex items-center gap-3">
                <Chip tone={r.tone}>MRR {r.mrr}</Chip>
                <RowActions ids={["view","edit","archive"]} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Payouts" && (
        <EmptyTable title="Next payout · 15 Jul 2027" hint="Payouts to your primary bank account happen on the 1st and 15th. Add split payouts to route partner and vendor shares automatically." cta="Add payout account" />
      )}

      {tab === "Wallets" && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { l: "Vala Wallet",     b: "₹1,24,300", tone: "premium" as const, i: Wallet },
            { l: "Reseller Wallet", b: "₹48,900",   tone: "success" as const, i: Building2 },
            { l: "Refund Reserve",  b: "₹28,000",   tone: "warning" as const, i: RotateCcw },
          ].map((r) => (
            <Card key={r.l}>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60 text-accent"><r.i className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-bold">{r.l}</div>
                  <div className="text-[11px] text-muted-foreground">Available</div>
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold">{r.b}</div>
              <div className="mt-3 flex gap-2"><PillButton variant="ghost">Top up</PillButton><PillButton variant="primary">Withdraw</PillButton></div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Coupons" && (
        <EmptyTable title="Manage coupons in Pricing" hint="Coupons live under Pricing → Coupons so they stay tied to the plan and currency they belong to." />
      )}
    </div>
  );
}

/* =============================================================
   RELEASES / PRODUCT RELEASE MANAGEMENT
   ============================================================= */

const RELEASES = [
  { v: "5.0.0-beta.2", p: "Vala ERP Pro",     tag: "Beta",       when: "Yesterday",  by: "release-bot", tone: "warning" as const },
  { v: "4.2.0",        p: "Vala ERP Pro",     tag: "Stable",     when: "2 days ago", by: "boss",        tone: "success" as const },
  { v: "4.1.0",        p: "Vala ERP Pro",     tag: "LTS",        when: "4 months",   by: "boss",        tone: "info" as const },
  { v: "3.7.1",        p: "Vala CRM Cloud",   tag: "Stable",     when: "1 week",     by: "boss",        tone: "success" as const },
  { v: "2.4.0",        p: "Vala HRMS",        tag: "Stable",     when: "3 weeks",    by: "author-01",   tone: "success" as const },
  { v: "3.9.7",        p: "Vala Restaurant",  tag: "Deprecated", when: "1 year",     by: "boss",        tone: "danger" as const },
];

export function ReleasesSection() {
  const [tab, setTab] = useState("Timeline");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Release Management"
        title="Versions, Changelogs & Roadmap"
        description="Ship Beta → Stable → LTS with signed builds, structured changelogs, roadmap voting and deprecation notices."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> New branch</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> New release</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Releases (all time)" value="482"                        tone="premium" icon={Rocket} />
        <MiniStat label="Stable"              value="128"                        tone="success" icon={BadgeCheck} />
        <MiniStat label="Beta channel"        value="14"                         tone="warning" icon={GitCommit} />
        <MiniStat label="Deprecated"          value="41"     delta="sunset plan" tone="destructive" icon={AlertTriangle} />
      </div>

      <SubNav items={["Timeline","Changelog","Roadmap","Beta Program","Deprecations"]} active={tab} onChange={setTab} />

      {tab === "Timeline" && (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          {RELEASES.map((r) => (
            <div key={r.v + r.p} className="relative mb-3">
              <span className="absolute -left-[18px] top-3 h-3 w-3 rounded-full border-2 border-accent bg-background shadow-[0_0_10px_oklch(0.80_0.13_192/0.7)]" />
              <div className="glass flex items-center justify-between rounded-xl p-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <GitCommit className="h-3.5 w-3.5 text-accent" />
                    <span className="font-mono">v{r.v}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{r.p}</span>
                    <Chip tone={r.tone}>{r.tag}</Chip>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{r.when} · by {r.by}</div>
                </div>
                <div className="flex gap-2">
                  <PillButton variant="ghost">Notes</PillButton>
                  <PillButton variant="ghost">Downloads</PillButton>
                  <PillButton variant="primary">Promote</PillButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Changelog" && (
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><GitMerge className="h-4 w-4 text-accent" /> v4.2.0 — Vala ERP Pro</div>
          <div className="space-y-3 text-[12px]">
            {[
              { t: "Added",   items: ["Offline sync for POS","AI copilot beta flag","Bulk license issuance"], tone: "success" as const },
              { t: "Changed", items: ["Faster PDP render (+18%)","Redesigned invoice PDF","Refactored tax engine"], tone: "premium" as const },
              { t: "Fixed",   items: ["Rare crash in report export","Coupon stacking edge case"], tone: "info" as const },
              { t: "Security",items: ["Upgraded crypto to Ed25519","Signed all binaries with Root CA"], tone: "warning" as const },
            ].map((g) => (
              <div key={g.t}>
                <Chip tone={g.tone}>{g.t}</Chip>
                <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-muted-foreground">
                  {g.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Roadmap" && (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { st: "Now",     items: ["5.0 core rewrite","AI copilot"], tone: "success" as const },
            { st: "Next",    items: ["Native mobile POS","Payroll v2"], tone: "premium" as const },
            { st: "Later",   items: ["Data warehouse","Marketplace API v2"], tone: "info" as const },
          ].map((c) => (
            <Card key={c.st}>
              <Chip tone={c.tone}>{c.st}</Chip>
              <ul className="mt-3 space-y-2 text-[12px]">
                {c.items.map((it) => (
                  <li key={it} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
                    <span>{it}</span>
                    <span className="font-mono text-[10px] tabular text-accent">▲ 128</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {tab === "Beta Program" && (
        <EmptyTable title="Beta program — invite-only" hint="Ship pre-release builds to opted-in customers, collect crash reports and feedback, and promote to Stable in one click." cta="Manage testers" />
      )}

      {tab === "Deprecations" && (
        <Card>
          <div className="divide-y divide-border/60">
            {[
              { v: "3.9.7", p: "Vala Restaurant", sunset: "2028-01-01", reason: "End of life" },
              { v: "2.x",   p: "Vala HRMS",        sunset: "2027-09-30", reason: "Merged into 3.0" },
            ].map((r) => (
              <div key={r.v} className="flex items-center justify-between py-3 text-[12px]">
                <div>
                  <div className="font-bold">{r.p} · <span className="font-mono">{r.v}</span></div>
                  <div className="text-[11px] text-muted-foreground">{r.reason}</div>
                </div>
                <Chip tone="danger">sunset {r.sunset}</Chip>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* Consumed elsewhere via aggregator re-exports */
export const __use = { Filter, Link2, MoreHorizontal, Search, Pencil, Eye, Trash2 };
