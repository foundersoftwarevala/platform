import { useOperator, useCan } from "../session";
import { useStudioManagement } from "./management-data";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ManagerPage } from "@/components/vala-ai/studio/manager-page";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/vala-ai/studio/ui/dialog";
import { Pencil, Trash2, Plus, Box, Zap, Check } from "lucide-react";
import {
  Home,
  Users,
  IdCard,
  FlaskConical,
  BarChart3,
  AlertTriangle,
  Package,
  Coins,
  UserPlus,
  DollarSign,
  CreditCard,
  BookOpen,
  FileText,
  Languages,
  MessageSquare,
  Sparkles,
  Monitor,
  Globe,
  Mail,
  Contact,
  Search,
  RefreshCw,
  Store,
  ChevronRight,
  ChevronUp,
} from "lucide-react";

const NAV: [string, typeof Home, boolean?][] = [
  ["Overview", Home],
  ["Users", Users],
  ["Roles", IdCard],
  ["Lab", FlaskConical],
  ["Usage", BarChart3],
  ["Failed turns", AlertTriangle],
  ["Packs", Package],
  ["Credits", Coins],
  ["Referrals", UserPlus, true],
  ["Finance", DollarSign, true],
  ["Payment Methods", CreditCard],
  ["Blog", BookOpen],
  ["Pages", FileText],
  ["Languages", Languages],
  ["Chat models", MessageSquare],
  ["API Integration", Sparkles, true],
  ["Sessions", Monitor],
  ["Landing page", Globe],
  ["Newsletter", Mail],
  ["Contacts", Contact],
  ["SEO", Search],
  ["Updates", RefreshCw],
  ["Marketplace", Store],
];

export function StudioOwner() {
  const { dashboard, error, ownerData } = useStudioManagement();
  const isOwner = useCan("owner");
  const STATS = [
    [
      "People",
      ownerData?.people.length ?? "UNVERIFIED",
      "Known Vala operators, not all platform accounts",
    ],
    ["Projects", dashboard?.projects.length ?? "UNVERIFIED", "Loaded module projects"],
    ["Chat", ownerData?.chat.length ?? "UNVERIFIED", "Recent chat messages"],
    ["MRR", "UNVERIFIED", "Not supplied by this internal module"],
    ["Collected this month", "UNVERIFIED", "Not supplied by this internal module"],
    ["Signed in", "UNVERIFIED", "Platform live-session count is not supplied"],
  ];
  const CHAT =
    ownerData?.chat.map((m) => ({
      lab: m.role !== "user",
      t: new Date(m.created_at).toLocaleString(),
      m: m.content,
    })) ?? [];
  const PEOPLE =
    ownerData?.people.map((p) => [
      p.email.slice(0, 2).toUpperCase(),
      p.email,
      p.role,
      new Date(p.last_seen_at).toLocaleString(),
    ]) ?? [];
  const [page, setPage] = useState("Overview");
  return (
    <div className="theme-builder studio-layout flex h-[calc(100vh-44px)] bg-card text-foreground">
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="grid size-6 place-items-center rounded bg-ink text-xs font-bold">V</span>
          <span className="text-sm font-semibold">Vala AI</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 text-[13px]">
          {NAV.map(([l, I, sub]) => (
            <button
              key={l}
              onClick={() => setPage(l)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${l === page ? "bg-secondary font-medium" : "text-studio-dim hover:bg-secondary"}`}
            >
              <I className="size-3.5" /> {l} {sub && <ChevronRight className="ml-auto size-3.5" />}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="grid size-6 place-items-center rounded bg-ink text-xs font-bold">V</span>
          <div className="flex-1">
            <div className="text-xs font-semibold">Vala AI</div>
            <div className="text-[10px] text-studio-dim">Owner</div>
          </div>
          <ChevronUp className="size-3.5 text-studio-dim" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-7 py-3.5 text-xs">
          <span>{page}</span>
          <span className="flex items-center gap-1 text-studio-dim">
            <Search className="size-3.5" /> ⌘K
          </span>
        </header>
        <main className="flex-1 overflow-y-auto">
          {page === "Payment Methods" ? (
            <Payments />
          ) : page === "Chat models" ? (
            <ChatModels />
          ) : page === "Updates" ? (
            <Updates />
          ) : page !== "Overview" ? (
            <ManagerPage name={page} />
          ) : (
            <div className="mx-auto max-w-[960px] px-6 py-8">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-studio-dim">OVERVIEW</div>
                  <h1 className="mt-1 text-xl font-semibold">Hello, Vala AI</h1>
                  <p className="mt-1 text-xs text-studio-dim">
                    What moved across people, Lab chat, and billing.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/vala-ai/builder"
                    className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-medium"
                  >
                    <FlaskConical className="size-3.5" /> Open Lab
                  </Link>
                  <button
                    onClick={() => setPage("Users")}
                    className="rounded-full border border-border px-4 py-1.5 text-xs font-medium"
                  >
                    People
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-4 text-destructive">
                  {error}
                </p>
              )}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {STATS.map(([k, v, n]) => (
                  <div key={k} className="rounded-xl bg-secondary p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                      {k}
                    </div>
                    <div className="mt-2 text-xl font-semibold">{v}</div>
                    <div className="mt-1 text-[10px] text-studio-dim">{n}</div>
                  </div>
                ))}
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <section className="rounded-xl bg-secondary p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Latest chat</span>
                    <span className="text-[10px]">
                      <span className="text-destructive">Review actual chat history</span>{" "}
                      <span className="ml-2 text-studio-dim">View all</span>
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {CHAT.map((c, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 rounded-lg p-2.5 ${c.lab ? "bg-background" : ""}`}
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card text-[10px]">
                          {c.lab ? <FlaskConical className="size-3" /> : "A"}
                        </span>
                        <div className="flex-1 text-xs">
                          <div className="flex justify-between text-[10px]">
                            <span>
                              <b className="font-medium">{c.lab ? "Lab" : "admin"}</b>{" "}
                              <span className="text-studio-dim">Vala AI</span>
                            </span>
                            <span className="text-studio-dim">{c.t}</span>
                          </div>
                          <p className="mt-0.5">{c.m}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="self-start rounded-xl bg-secondary p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Latest people</span>
                    <span className="text-[10px] text-studio-dim">View all</span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {PEOPLE.map(([ini, n, e, t]) => (
                      <div key={n} className="flex items-center gap-3 p-1.5 text-xs">
                        <span className="grid size-6 place-items-center rounded-full bg-card text-[9px] font-medium">
                          {ini}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium">{n}</div>
                          <div className="text-[10px] text-studio-dim">{e}</div>
                        </div>
                        <div className="text-right text-[10px] text-studio-dim">
                          <div>Member</div>
                          <div>{t}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const METHODS = [
  ["Stripe", "Cards and wallets through Stripe Checkout."],
  ["PayPal", "PayPal Checkout with REST credentials."],
  ["Dodo Payments", "Global checkout sessions through Dodo Payments."],
  ["Cashfree", "Cashfree Payment Links for cards, UPI, and wallets."],
  ["Razorpay", "Razorpay Payment Links for cards, UPI, and wallets."],
  ["YooKassa", "Cards, SBP, and wallets through YooKassa (YuKassa)."],
  ["LigdiCash", "Mobile money checkout in West Africa through LigdiCash (XOF)."],
  ["Whop", "Global checkout through Whop (cards, wallets, and local methods)."],
  ["Paddle", "Merchant of record checkout through Paddle Billing (cards and local methods)."],
] as [string, string, boolean?][];

type PM = { n: string; d: string; mode: "Test" | "Live"; key: string };
const field = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none";

function Payments() {
  const { payments: rows, savePayments: setRows, error } = useStudioManagement();
  const [edit, setEdit] = useState<PM | null>(null);
  return (
    <div className="mx-auto flex min-h-full max-w-[860px] flex-col px-6 py-8">
      <h1 className="text-lg font-semibold">Payment Methods</h1>
      <p className="mt-0.5 text-xs text-studio-dim">
        Connect Stripe, PayPal, Dodo Payments, Cashfree, Razorpay, YooKassa, LigdiCash, and Whop.
        Keys are encrypted on the server; configured does not mean provider acceptance was tested.
        No payment is executed here.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-destructive">
          {error}
        </p>
      )}
      <table className="mt-6 w-full overflow-hidden rounded-xl border border-border text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] tracking-wider text-studio-dim">
            <th className="px-4 py-3 font-semibold">METHOD</th>
            <th className="font-semibold">MODE</th>
            <th className="font-semibold">KEYS</th>
            <th className="font-semibold">STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, d, mode, key }) => {
            const on = !!key;
            return (
              <tr key={n} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{n}</div>
                  <div className="text-[10px] text-studio-dim">{d}</div>
                </td>
                <td className="text-studio-dim">{mode}</td>
                <td>{on ? "Configured" : "Not configured"}</td>
                <td>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[9px] ${on ? "border-studio-ok/30 bg-studio-ok/10 text-studio-ok" : "border-border text-studio-dim"}`}
                  >
                    {on ? "Configured · UNVERIFIED" : "Off"}
                  </span>
                </td>
                <td className="pr-6 text-right">
                  <button
                    aria-label={`Edit ${n}`}
                    onClick={() => setEdit(rows.find((r) => r.n === n)!)}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="vala-studio theme-builder bg-card text-foreground">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>{edit.n}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-studio-dim">{edit.d}</p>
              <label className="text-xs font-medium">
                Mode
                <select
                  value={edit.mode}
                  onChange={(e) => setEdit({ ...edit, mode: e.target.value as PM["mode"] })}
                  className={`${field} mt-1`}
                >
                  <option>Test</option>
                  <option>Live</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Secret key
                <input
                  type="password"
                  value={edit.key === "configured" ? "" : edit.key}
                  placeholder={edit.key ? "•••••••• (saved — type to replace)" : "Paste key"}
                  onChange={(e) => setEdit({ ...edit, key: e.target.value })}
                  className={`${field} mt-1`}
                />
              </label>
              <DialogFooter className="gap-2">
                {edit.key && (
                  <button
                    onClick={() => {
                      setRows((r) => r.map((x) => (x.n === edit.n ? { ...edit, key: "" } : x)));
                      setEdit(null);
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    Turn off
                  </button>
                )}
                <button
                  onClick={() => {
                    setRows((r) => r.map((x) => (x.n === edit.n ? edit : x)));
                    setEdit(null);
                  }}
                  className="bg-ink rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Save
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <div className="mt-6 text-xs">
        <b>{rows.length ? `1–${rows.length}` : "0"}</b> <span className="text-studio-dim">/ 9</span>
      </div>
      <div className="mt-auto pt-10 text-right font-mono text-[10px] text-studio-dim">v2.1.0</div>
    </div>
  );
}

function ChatModels() {
  const { aliases: rows, saveAliases: setRows, modelNames, error } = useStudioManagement();
  const [edit, setEdit] = useState<{
    n: string;
    m: string;
    def?: boolean;
    fast?: boolean;
    orig: string;
  } | null>(null);
  return (
    <div className="mx-auto flex min-h-full max-w-[860px] flex-col px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Chat models</h1>
          <p className="mt-0.5 text-xs text-studio-dim">
            Friendly names Lab shows in the composer. Alias metadata is saved here; active routing
            remains in Vala Settings and AI API Manager.
          </p>
        </div>
        <button
          aria-label="Add model"
          onClick={() => setRows((r) => [...r, { n: `Vala AI Custom ${r.length + 1}`, m: "" }])}
        >
          <Plus className="size-4" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-destructive">
          {error}
        </p>
      )}
      <table className="mt-6 w-full rounded-xl border border-border text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] tracking-wider text-studio-dim">
            <th className="px-4 py-3 font-semibold">NAME</th>
            <th className="font-semibold">MAPPED MODEL</th>
            <th className="font-semibold">STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className="border-b border-border last:border-0">
              <td className="px-4 py-3.5">
                <span className="flex items-center gap-2 font-medium">
                  {r.fast ? <Zap className="size-4" /> : <Box className="size-4" />}
                  {r.n}
                  {r.def && (
                    <span className="rounded border border-border px-1.5 text-[9px] font-normal text-studio-dim">
                      Default
                    </span>
                  )}
                </span>
              </td>
              <td className="text-studio-dim">{r.m || "—"}</td>
              <td>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] ${r.m ? "border-studio-ok/30 bg-studio-ok/10 text-studio-ok" : "border-primary/30 bg-primary/10 text-primary"}`}
                >
                  {r.m ? "Alias saved (configured model)" : "Not mapped"}
                </span>
              </td>
              <td className="pr-6">
                <span className="flex justify-end gap-4">
                  <button aria-label={`Edit ${r.n}`} onClick={() => setEdit({ ...r, orig: r.n })}>
                    <Pencil className="size-3.5" />
                  </button>
                  {!r.def && (
                    <button
                      aria-label={`Delete ${r.n}`}
                      onClick={() => setRows((x) => x.filter((y) => y.n !== r.n))}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="theme-builder bg-card text-foreground">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>Edit chat model</DialogTitle>
              </DialogHeader>
              <label className="text-xs font-medium">
                Friendly name
                <input
                  value={edit.n}
                  onChange={(e) => setEdit({ ...edit, n: e.target.value })}
                  className={`${field} mt-1`}
                />
              </label>
              <label className="text-xs font-medium">
                Mapped model
                <select
                  value={edit.m}
                  onChange={(e) => setEdit({ ...edit, m: e.target.value })}
                  className={`${field} mt-1`}
                >
                  <option value="">Not mapped</option>
                  {modelNames.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <DialogFooter>
                <button
                  disabled={
                    !edit.n.trim() || rows.some((r) => r.n === edit.n.trim() && r.n !== edit.orig)
                  }
                  onClick={() => {
                    const { orig, ...v } = edit;
                    setRows((r) => r.map((x) => (x.n === orig ? { ...v, n: v.n.trim() } : x)));
                    setEdit(null);
                  }}
                  className="bg-ink rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  Save
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <div className="mt-6 text-xs">
        <b>{rows.length ? `1–${rows.length}` : "0"}</b>{" "}
        <span className="text-studio-dim">/ {rows.length}</span>
      </div>
      <div className="mt-auto pt-10 text-right font-mono text-[10px] text-studio-dim">v2.1.0</div>
    </div>
  );
}

const SOURCE_CHANGES = [
  "UK/EU VAT engine: domestic VAT, EU OSS destination rates, cross-border B2B reverse charge, out-of-scope handling",
  "Standard VAT/GST rates for every taxing country (Estonia 24 %, Romania 21 % updated for 2026)",
  "Seller tax profile (Finance → Billing): legal name, address, country, tax ID, EU OSS flag, extra registrations, invoice prefix",
  "Per-country tax ID format validation for seller and buyer (VAT, EIN, GST, ABN, and more)",
  "Buyer business billing (Settings → Billing): individual / business, legal name, address, country, tax ID",
  "Checkout gated until the buyer's billing profile is complete; full ISO 3166-1 country list",
  "Standalone invoice PDFs with frozen seller/buyer snapshots and amounts once issued",
  "Sequential invoice numbering per issue year for paid and refunded invoices",
  "php artisan invoices:backfill numbers legacy paid invoices chronologically",
  "Sample invoice preview rendered in memory — never touches the ledger or revenue totals",
  "Users download their own invoices from Settings → Invoices",
  "Admin invoice filters by user, status, month, and custom date range",
  "Admin export as CSV / TSV / JSON with full accounting columns (net, tax, gross, rate, treatment, reverse charge, MoR flag, both parties' tax IDs and addresses)",
  "Admin PDF bundle: ZIP of every filtered invoice plus a matching CSV",
  "Paddle gateway (merchant of record): checkout, webhook signature validation, refunds",
  "Paddle buyer sync: customer, address, and business with tax ID mirrored so reverse charge / local VAT is applied automatically",
  "Paddle statutory tax rate recorded from the transaction for exact invoice math",
  "Whop gateway (merchant of record): plan-based checkout with exclusive tax, webhook validation, refunds",
  "Whop billing address and tax facts parsed from the real Payment schema",
];

function Updates() {
  return (
    <div className="mx-auto max-w-[860px] px-6 py-8">
      <h1 className="text-lg font-semibold">Updates</h1>
      <p className="mt-0.5 text-xs text-studio-dim">
        Install product updates without losing your data.
      </p>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-secondary p-8">
        <div>
          <div className="text-[10px] tracking-[0.2em] text-studio-dim">STATUS</div>
          <div className="mt-2 text-lg font-semibold">Installed platform release: UNVERIFIED</div>
          <div className="mt-3 text-xs text-studio-dim">
            Imported source revision <span className="font-mono text-foreground">6c585055</span>
          </div>
        </div>
        <span className="grid size-8 place-items-center rounded-full bg-studio-ok text-primary-foreground">
          <Check className="size-4" />
        </span>
      </div>
      <div className="mt-8 text-[10px] tracking-[0.2em] text-studio-dim">CHANGE-LOG</div>
      <span className="mt-4 inline-block rounded bg-secondary px-2 py-1 font-mono text-[10px]">
        Source repository changelog — capability claims are UNVERIFIED
      </span>
      <ul className="mt-3 space-y-2.5 text-[13px]">
        {SOURCE_CHANGES.map((c) => (
          <li key={c} className="flex gap-3">
            <span className="h-fit shrink-0 rounded bg-studio-ok/15 px-2.5 py-0.5 text-[10px] font-medium text-studio-ok">
              New
            </span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
