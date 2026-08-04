import { useState, type ReactNode } from "react";
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Clock, Archive, RotateCcw, Copy,
  GitMerge, Trash2, Ban, Play, Pause, RefreshCw, ExternalLink, Link2, QrCode,
  Globe2, Image as ImageIcon, Bot, Search, FileText, MessageSquare, Phone, Mail,
  Calendar, Video, Download, Award, AlertTriangle, Eye, MousePointerClick, Layers,
  History, Upload, DownloadCloud, ClipboardCheck, Sparkles, Lock, Users, BarChart3,
  ChevronRight, Fingerprint, Radar, Bug, ScanLine, Wand2, KeyRound, Rocket,
  ArrowUpRight, TrendingUp, Star, GitBranch, Save, ListChecks,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, StatCard, SubNav, SectionRow } from "../ui";

/* =====================================================================
   Shared micro-primitives (governance-scoped)
   ===================================================================== */

function Tone({ tone, children }: { tone: "info" | "success" | "warning" | "danger" | "muted" | "premium"; children: ReactNode }) {
  const map: Record<string, string> = {
    info: "bg-accent/15 text-accent border-accent/30",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    muted: "bg-white/[0.04] text-muted-foreground border-border",
    premium: "bg-premium/15 text-premium border-premium/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[tone]}`}>
      {children}
    </span>
  );
}

function IconBtn({ icon: Icon, label, tone = "muted", onClick }: { icon: any; label: string; tone?: "muted" | "danger" | "success" | "accent"; onClick?: () => void }) {
  const toneCls: Record<string, string> = {
    muted: "hover:border-accent/40 hover:text-accent",
    danger: "hover:border-destructive/50 hover:text-destructive",
    success: "hover:border-success/50 hover:text-success",
    accent: "border-accent/40 text-accent hover:bg-accent/10",
  };
  return (
    <button
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 text-[11px] font-semibold text-foreground transition-all ${toneCls[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Input({ value, placeholder, mono = false }: { value?: string; placeholder?: string; mono?: boolean }) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      className={`w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 ${mono ? "font-mono tabular" : ""}`}
    />
  );
}

function Toggle({ on, label }: { on?: boolean; label: string }) {
  const [v, setV] = useState(!!on);
  return (
    <button
      onClick={() => setV(!v)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-left transition-colors hover:border-accent/40"
    >
      <span className="text-[12px] font-semibold text-foreground">{label}</span>
      <span className={`relative h-4 w-7 rounded-full transition-colors ${v ? "bg-accent" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${v ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

/* =====================================================================
   AUTHOR APPROVAL SYSTEM
   ===================================================================== */

const STATUSES = [
  { id: "draft", label: "Draft", tone: "muted" as const, count: 12 },
  { id: "pending", label: "Pending Review", tone: "warning" as const, count: 8 },
  { id: "verification", label: "Under Verification", tone: "info" as const, count: 4 },
  { id: "changes", label: "Changes Requested", tone: "warning" as const, count: 3 },
  { id: "approved", label: "Approved", tone: "success" as const, count: 47 },
  { id: "rejected", label: "Rejected", tone: "danger" as const, count: 6 },
  { id: "published", label: "Published", tone: "premium" as const, count: 128 },
  { id: "unpublished", label: "Unpublished", tone: "muted" as const, count: 9 },
  { id: "archived", label: "Archived", tone: "muted" as const, count: 21 },
  { id: "suspended", label: "Suspended", tone: "danger" as const, count: 2 },
];

const AUTHOR_QUEUE = [
  { id: "SVA-1041", name: "Vala CRM Pro v3.1", author: "Byteforge Labs", type: "Update", submitted: "2h ago", status: "pending", risk: 12 },
  { id: "SVA-1040", name: "InvoiceMint Cloud", author: "MintStack", type: "New", submitted: "6h ago", status: "verification", risk: 34 },
  { id: "SVA-1039", name: "PixelHR Suite", author: "Neon Works", type: "New", submitted: "1d ago", status: "changes", risk: 8 },
  { id: "SVA-1038", name: "AI Ticket Router", author: "Skywave", type: "Update", submitted: "1d ago", status: "pending", risk: 46 },
  { id: "SVA-1037", name: "RetailPulse POS", author: "ForgeIT", type: "New", submitted: "3d ago", status: "approved", risk: 4 },
];

export function AuthorApprovalSection() {
  const [tab, setTab] = useState("All Submissions");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Author Approval"
        title="Author Approval Workflow"
        description="Every author submission is reviewed, verified and approved by the Marketplace Manager before going public."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Approval History</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Review Next</span></PillButton>
          </>
        }
      />

      <SubNav items={["All Submissions", "Pending", "Verifying", "Changes Requested", "Approved", "Rejected", "Suspended", "Archived"]} active={tab} onChange={setTab} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATUSES.slice(0, 5).map((s) => (
          <StatCard key={s.id} label={s.label} value={String(s.count)} tone={s.tone === "muted" ? "default" : s.tone === "info" ? "default" : s.tone as any} />
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold">Submission Queue</span>
            <Tone tone="info">{AUTHOR_QUEUE.length} in queue</Tone>
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn icon={CheckCircle2} label="Bulk Approve" tone="success" />
            <IconBtn icon={XCircle} label="Bulk Reject" tone="danger" />
            <IconBtn icon={Ban} label="Suspend" tone="danger" />
            <IconBtn icon={Archive} label="Archive" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {AUTHOR_QUEUE.map((r) => {
            const st = STATUSES.find((s) => s.id === r.status)!;
            return (
              <div key={r.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                <input type="checkbox" className="col-span-1 accent-accent" />
                <div className="col-span-4">
                  <div className="text-sm font-bold">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">by <span className="text-foreground/80">{r.author}</span> · <span className="font-mono tabular">{r.id}</span></div>
                </div>
                <div className="col-span-1"><Tone tone={r.type === "New" ? "premium" : "info"}>{r.type}</Tone></div>
                <div className="col-span-2 text-[11px] text-muted-foreground">Submitted {r.submitted}</div>
                <div className="col-span-1"><Tone tone={r.risk > 40 ? "danger" : r.risk > 20 ? "warning" : "success"}>Risk {r.risk}</Tone></div>
                <div className="col-span-1"><Tone tone={st.tone === "muted" ? "muted" : st.tone as any}>{st.label}</Tone></div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <IconBtn icon={Eye} label="Review" tone="accent" />
                  <IconBtn icon={CheckCircle2} label="Approve" tone="success" />
                  <IconBtn icon={XCircle} label="Reject" tone="danger" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Approval Rules</div>
          <div className="space-y-2">
            <Toggle on label="Require manual review for new authors" />
            <Toggle on label="Auto-verify updates from trusted authors" />
            <Toggle label="Skip review for security-only patches" />
            <Toggle on label="Notify author on status change" />
          </div>
        </Card>
        <Card>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SLA & Escalation</div>
          <div className="space-y-2">
            <Field label="Response SLA"><Input value="24 hours" mono /></Field>
            <Field label="Escalate after"><Input value="48 hours" mono /></Field>
            <Field label="Auto-reject stale drafts after"><Input value="30 days" mono /></Field>
          </div>
        </Card>
        <Card>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trusted Authors</div>
          <div className="space-y-1.5">
            {["Byteforge Labs", "MintStack", "Neon Works", "ForgeIT"].map((n) => (
              <div key={n} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div className="text-[12px] font-semibold">{n}</div>
                <Tone tone="success">Verified</Tone>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   PRODUCT MODERATION
   ===================================================================== */

const MOD_ROWS = [
  { id: "PRD-8821", name: "Vala ERP Pro", author: "Software Vala", flag: "Duplicate suspected", tone: "warning", dup: 2 },
  { id: "PRD-8802", name: "InvoiceMint", author: "MintStack", flag: "Content review", tone: "info", dup: 0 },
  { id: "PRD-8790", name: "TicketRouter AI", author: "Skywave", flag: "Copyright report", tone: "danger", dup: 0 },
  { id: "PRD-8781", name: "PixelHR Lite", author: "Neon Works", flag: "Clean", tone: "success", dup: 0 },
];

export function ModerationSection() {
  const [tab, setTab] = useState("Queue");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Moderation"
        title="Product Moderation Center"
        description="Approve, reject, suspend, archive, restore, clone, merge duplicates and run bulk operations across every listing."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><GitMerge className="h-3.5 w-3.5" /> Duplicate Scanner</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Run Full Audit</span></PillButton>
          </>
        }
      />
      <SubNav items={["Queue", "Duplicates", "Reports", "Archived", "Soft Deleted", "Trash"]} active={tab} onChange={setTab} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Awaiting Moderation" value="14" tone="warning" icon={<ShieldAlert className="h-3.5 w-3.5" />} />
        <StatCard label="Duplicates Detected" value="6" tone="destructive" icon={<GitMerge className="h-3.5 w-3.5" />} />
        <StatCard label="Reported This Week" value="9" tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <StatCard label="Clean Listings" value="1,284" tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold">Bulk Operations</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <IconBtn icon={CheckCircle2} label="Bulk Approve" tone="success" />
            <IconBtn icon={XCircle} label="Bulk Reject" tone="danger" />
            <IconBtn icon={Rocket} label="Bulk Publish" tone="accent" />
            <IconBtn icon={Pause} label="Bulk Unpublish" />
            <IconBtn icon={Layers} label="Bulk Category" />
            <IconBtn icon={Users} label="Bulk Author" />
            <IconBtn icon={Trash2} label="Bulk Delete" tone="danger" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {MOD_ROWS.map((r) => (
            <div key={r.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
              <input type="checkbox" className="col-span-1 accent-accent" />
              <div className="col-span-4">
                <div className="text-sm font-bold">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">by {r.author} · <span className="font-mono tabular">{r.id}</span>{r.dup ? <> · <span className="text-warning">{r.dup} duplicates</span></> : null}</div>
              </div>
              <div className="col-span-3"><Tone tone={r.tone as any}>{r.flag}</Tone></div>
              <div className="col-span-4 flex items-center justify-end gap-1">
                <IconBtn icon={CheckCircle2} label="Approve" tone="success" />
                <IconBtn icon={XCircle} label="Reject" tone="danger" />
                <IconBtn icon={Ban} label="Suspend" tone="danger" />
                <IconBtn icon={Archive} label="Archive" />
                <IconBtn icon={RotateCcw} label="Restore" />
                <IconBtn icon={Copy} label="Clone" />
                <IconBtn icon={GitMerge} label="Merge" tone="accent" />
                <IconBtn icon={Trash2} label="Delete" tone="danger" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Duplicate Product Merger</div>
          </div>
          <div className="space-y-2">
            {[
              { a: "Vala ERP Pro", b: "Vala ERP Professional", score: 92 },
              { a: "InvoiceMint", b: "Invoice Mint Cloud", score: 84 },
              { a: "PixelHR", b: "Pixel HR Suite", score: 71 },
            ].map((d) => (
              <div key={d.a} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold">{d.a} <span className="text-muted-foreground">↔</span> {d.b}</div>
                  <Tone tone={d.score > 85 ? "danger" : "warning"}>{d.score}% match</Tone>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <IconBtn icon={GitMerge} label="Merge" tone="accent" />
                  <IconBtn icon={Eye} label="Compare" />
                  <IconBtn icon={XCircle} label="Not a duplicate" tone="muted" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <div className="text-sm font-bold">Deletion Policy</div>
          </div>
          <div className="space-y-2">
            <Toggle on label="Soft delete first — 30 day recovery window" />
            <Toggle label="Require dual approval for permanent delete" />
            <Toggle on label="Preserve orders and licenses on deletion" />
            <Toggle label="Auto-purge soft deleted after 90 days" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   AUTO DEMO DOMAIN
   ===================================================================== */

const DEMO_ROWS = [
  { slug: "vala-erp-pro", status: "live", ssl: true, expires: "in 12 days", hits: "1,824" },
  { slug: "invoicemint", status: "live", ssl: true, expires: "in 7 days", hits: "612" },
  { slug: "pixelhr", status: "resetting", ssl: true, expires: "in 3 days", hits: "204" },
  { slug: "ticket-router-ai", status: "disabled", ssl: false, expires: "—", hits: "0" },
];

export function DemoDomainSection() {
  const [tab, setTab] = useState("All Demos");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Auto Demo Domain"
        title="Demo Domain Manager"
        description="Every published product gets a live demo on softwarewala.net — generate, regenerate, enable, disable, reset, share and QR from one place."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Regenerate All</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> Provision Demo</span></PillButton>
          </>
        }
      />
      <SubNav items={["All Demos", "Live", "Resetting", "Disabled", "Expired"]} active={tab} onChange={setTab} />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Domain Pattern</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Path pattern" hint="Used for shared sandbox"><Input value="https://demo.softwarewala.net/{slug}" mono /></Field>
            <Field label="Subdomain pattern" hint="Isolated per product"><Input value="https://{slug}.demo.softwarewala.net" mono /></Field>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Toggle on label="Auto-provision on first publish" />
            <Toggle on label="Wildcard SSL (auto-renew)" />
            <Toggle on label="Block indexing on demo domains" />
            <Toggle label="Password protect by default" />
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <div className="text-sm font-bold">Software Vala Branding Lock</div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Author-uploaded favicon, logo, manifest, browserconfig and PWA assets are automatically replaced with Software Vala branding on every demo domain. Third-party branding is never allowed.</p>
          <div className="space-y-2">
            {[
              "favicon.ico → svala-favicon.ico",
              "apple-touch-icon → svala-apple-touch.png",
              "manifest.json → svala-manifest.json",
              "browserconfig.xml → svala-browserconfig.xml",
              "PWA icons (192/512) → svala-pwa-*.png",
            ].map((s) => (
              <div key={s} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div className="font-mono text-[11px] tabular">{s}</div>
                <Tone tone="success">Protected</Tone>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold">Provisioned Demos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn icon={RefreshCw} label="Regenerate" />
            <IconBtn icon={Play} label="Enable" tone="success" />
            <IconBtn icon={Pause} label="Disable" />
            <IconBtn icon={RotateCcw} label="Reset" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {DEMO_ROWS.map((d) => (
            <div key={d.slug} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
              <div className="col-span-5">
                <div className="text-sm font-bold">{d.slug}</div>
                <div className="font-mono text-[11px] tabular text-muted-foreground">https://{d.slug}.demo.softwarewala.net</div>
              </div>
              <div className="col-span-1"><Tone tone={d.status === "live" ? "success" : d.status === "resetting" ? "warning" : "muted"}>{d.status}</Tone></div>
              <div className="col-span-1"><Tone tone={d.ssl ? "success" : "danger"}>{d.ssl ? "SSL" : "No SSL"}</Tone></div>
              <div className="col-span-2 text-[11px] text-muted-foreground">Expires {d.expires}</div>
              <div className="col-span-1 font-mono text-[11px] tabular text-muted-foreground">{d.hits} hits</div>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <IconBtn icon={Copy} label="Copy" />
                <IconBtn icon={ExternalLink} label="Open" tone="accent" />
                <IconBtn icon={QrCode} label="QR" />
                <IconBtn icon={RotateCcw} label="Reset" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* =====================================================================
   DEMO SANDBOX
   ===================================================================== */

export function DemoSandboxSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Demo Sandbox"
        title="Demo Sandbox Controls"
        description="Every product demo runs inside an isolated sandbox. Manage expiry, resets, demo credentials and automated cleanup."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active Sandboxes" value="42" tone="success" />
        <StatCard label="Resetting Now" value="3" tone="warning" />
        <StatCard label="Expiring 24h" value="7" tone="warning" />
        <StatCard label="Auto Cleanups Today" value="18" tone="premium" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Reset Policy</div>
          </div>
          <div className="space-y-2">
            <Field label="Auto database reset every"><Input value="6 hours" mono /></Field>
            <Field label="Sandbox expiry"><Input value="24 hours after last hit" mono /></Field>
            <Field label="Cleanup window"><Input value="Every night 02:00 IST" mono /></Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Toggle on label="Auto reset DB" />
              <Toggle on label="Auto reset uploads" />
              <Toggle on label="Rotate demo credentials" />
              <Toggle label="Keep session logs" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Demo Credentials</div>
          </div>
          <div className="space-y-2">
            <Field label="Demo user"><Input value="demo@softwarewala.net" mono /></Field>
            <Field label="Demo password"><Input value="Vala@Demo#2026" mono /></Field>
            <Field label="Demo admin"><Input value="admin@softwarewala.net" mono /></Field>
            <Field label="Admin password"><Input value="Boss@Demo#2026" mono /></Field>
            <div className="mt-3 flex gap-2">
              <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Rotate</span></PillButton>
              <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</span></PillButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   AUTO PRODUCT URL
   ===================================================================== */

const URL_ROWS = [
  { name: "Vala ERP Pro", cat: "erp", slug: "vala-erp-pro" },
  { name: "InvoiceMint Cloud", cat: "billing", slug: "invoicemint-cloud" },
  { name: "PixelHR Suite", cat: "hr", slug: "pixelhr-suite" },
];

export function ProductUrlSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · URL Automation"
        title="Auto Product URL & Sharing"
        description="Generate SEO-optimised URLs, short links, QR codes and shareable snippets for every product automatically."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">URL Pattern</div>
          </div>
          <Field label="Canonical pattern"><Input value="/software/{category}/{product-name}" mono /></Field>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Toggle on label="Auto SEO slug from title" />
            <Toggle on label="Lowercase & hyphenate" />
            <Toggle on label="Strip stop words" />
            <Toggle label="Include product ID suffix" />
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Short Link & QR</div>
          </div>
          <Field label="Short domain"><Input value="svl.to" mono /></Field>
          <Field label="QR foreground"><Input value="#00D0FF" mono /></Field>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Toggle on label="Generate QR on publish" />
            <Toggle on label="Track short-link clicks" />
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-bold">Generated URLs</div>
          <IconBtn icon={RefreshCw} label="Regenerate All" tone="accent" />
        </div>
        <div className="divide-y divide-border">
          {URL_ROWS.map((r) => (
            <div key={r.slug} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
              <div className="col-span-3 text-sm font-bold">{r.name}</div>
              <div className="col-span-5 font-mono text-[11px] tabular text-muted-foreground">/software/{r.cat}/{r.slug}</div>
              <div className="col-span-2 font-mono text-[11px] tabular text-accent">svl.to/{r.slug.slice(0, 6)}</div>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <IconBtn icon={Copy} label="Copy" />
                <IconBtn icon={ExternalLink} label="Open" />
                <IconBtn icon={QrCode} label="QR" />
                <IconBtn icon={ArrowUpRight} label="Share" tone="accent" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* =====================================================================
   FAVICON PROTECTION
   ===================================================================== */

export function FaviconProtectionSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Brand Protection"
        title="Favicon & Branding Protection"
        description="Author-supplied branding assets are automatically stripped and replaced with Software Vala identity on every marketplace page and demo."
        actions={
          <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Enforce Now</span></PillButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Protected Assets" value="12,842" tone="success" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <StatCard label="Replaced Today" value="316" tone="premium" icon={<Wand2 className="h-3.5 w-3.5" />} />
        <StatCard label="Violations Blocked" value="24" tone="warning" icon={<ShieldAlert className="h-3.5 w-3.5" />} />
        <StatCard label="Whitelist Exceptions" value="0" tone="default" icon={<Lock className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Asset Enforcement Rules</div>
          </div>
          <div className="space-y-2">
            {[
              { k: "favicon.ico", v: "svala-favicon.ico" },
              { k: "favicon-16.png / favicon-32.png", v: "svala-favicon-{16,32}.png" },
              { k: "apple-touch-icon.png", v: "svala-apple-touch.png" },
              { k: "logo.svg / logo.png", v: "svala-logo.{svg,png}" },
              { k: "manifest.json / manifest.webmanifest", v: "svala-manifest.json" },
              { k: "browserconfig.xml", v: "svala-browserconfig.xml" },
              { k: "pwa-icon-192.png / pwa-icon-512.png", v: "svala-pwa-{192,512}.png" },
              { k: "og-image.png / twitter-card.png", v: "svala-og-default.png" },
            ].map((r) => (
              <div key={r.k} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                <div className="col-span-5 font-mono text-[11px] tabular">{r.k}</div>
                <ChevronRight className="col-span-1 h-4 w-4 text-muted-foreground" />
                <div className="col-span-4 font-mono text-[11px] tabular text-accent">{r.v}</div>
                <div className="col-span-2 flex justify-end"><Tone tone="success">Auto-replace</Tone></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-premium" />
            <div className="text-sm font-bold">Global Guard</div>
          </div>
          <div className="space-y-2">
            <Toggle on label="Block third-party favicons" />
            <Toggle on label="Block third-party manifest / PWA" />
            <Toggle on label="Block external logo hotlinks" />
            <Toggle on label="Replace on upload (never store originals)" />
            <Toggle on label="Sign every replaced asset" />
            <Toggle label="Allow whitelist exceptions (dual-approval)" />
          </div>
          <div className="mt-4 rounded-lg border border-premium/40 bg-premium/10 p-3 text-[11px] text-premium">
            Software Vala branding, favicon, logo and manifest are cryptographically enforced on every demo and marketplace page.
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   SEO AUTOMATION
   ===================================================================== */

export function SeoAutomationSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · SEO Automation"
        title="SEO Auto-Generator"
        description="Automatically produce meta tags, OpenGraph, Twitter cards, JSON-LD schemas, sitemap entries and robots rules for every product."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Rebuild Sitemap</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Regenerate SEO</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="SEO Coverage" value="98%" tone="success" />
        <StatCard label="Schemas Emitted" value="1,842" tone="premium" />
        <StatCard label="Sitemap URLs" value="12,406" />
        <StatCard label="Robots Rules" value="34" tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-bold">Automatic Generation</div>
          <div className="grid gap-2 md:grid-cols-2">
            {["Meta Title", "Meta Description", "Keywords", "Canonical URL", "OpenGraph", "Twitter Cards", "JSON-LD", "Product Schema", "FAQ Schema", "Review Schema", "Breadcrumb Schema", "Sitemap Entry"].map((k) => (
              <Toggle key={k} on label={k} />
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-bold">Robots & Indexing</div>
          <div className="space-y-2">
            <Field label="Default robots"><Input value="index, follow, max-image-preview:large" mono /></Field>
            <Field label="Sitemap URL"><Input value="https://softwarewala.net/sitemap.xml" mono /></Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Toggle on label="Block demo subdomains" />
              <Toggle on label="Auto submit sitemap" />
              <Toggle label="AI overviews opt-in" />
              <Toggle on label="Structured data validation" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Preview — Vala ERP Pro</div>
          </div>
          <pre className="scroll-row max-h-72 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{`<title>Vala ERP Pro — Enterprise ERP for growing teams | Software Vala</title>
<meta name="description" content="Vala ERP Pro delivers finance, inventory, HR and CRM in one modular ERP. Try the live demo, get a lifetime license from Software Vala." />
<link rel="canonical" href="https://softwarewala.net/software/erp/vala-erp-pro" />
<meta property="og:title" content="Vala ERP Pro" />
<meta property="og:image" content="https://cdn.softwarewala.net/og/vala-erp-pro.png" />
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Product",
  "name":"Vala ERP Pro",
  "brand":"Software Vala",
  "aggregateRating":{"@type":"AggregateRating","ratingValue":4.8,"reviewCount":1214},
  "offers":{"@type":"Offer","priceCurrency":"INR","price":14999,"availability":"InStock"}
}
</script>`}</pre>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   LEAD GENERATION + MANAGEMENT
   ===================================================================== */

const LEADS = [
  { id: "LD-8842", name: "Rohit Sharma", company: "Elevate Retail", src: "Request Demo", product: "Vala ERP Pro", score: 92, status: "New", owner: "—" },
  { id: "LD-8841", name: "Aditi Rao", company: "Northwind", src: "WhatsApp", product: "InvoiceMint", score: 74, status: "Contacted", owner: "Riya" },
  { id: "LD-8840", name: "Karan Mehta", company: "Blueprint", src: "Contact Sales", product: "PixelHR", score: 61, status: "Qualified", owner: "Aman" },
  { id: "LD-8839", name: "Sneha Iyer", company: "Cognify", src: "Enterprise Inquiry", product: "TicketRouter AI", score: 88, status: "Converted", owner: "Riya" },
];

export function LeadsSection() {
  const [tab, setTab] = useState("Pipeline");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Lead Ops"
        title="Lead Generation & Management"
        description="Every product page collects leads via demo, callback, WhatsApp, email, sales, brochure and enterprise inquiry — all routed here."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><DownloadCloud className="h-3.5 w-3.5" /> Export</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AI Lead Scoring</span></PillButton>
          </>
        }
      />
      <SubNav items={["Pipeline", "New", "Contacted", "Qualified", "Converted", "Lost"]} active={tab} onChange={setTab} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total Leads" value="1,284" tone="premium" />
        <StatCard label="New Today" value="42" tone="success" />
        <StatCard label="Qualified" value="318" />
        <StatCard label="Converted MTD" value="87" tone="success" />
        <StatCard label="Avg Score" value="71" tone="warning" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">CTAs Enabled on every product</div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              { i: Play, l: "Request Demo" },
              { i: Phone, l: "Request Callback" },
              { i: MessageSquare, l: "WhatsApp Lead" },
              { i: Mail, l: "Email Lead" },
              { i: Users, l: "Contact Sales" },
              { i: Download, l: "Download Brochure" },
              { i: Calendar, l: "Schedule Meeting" },
              { i: Video, l: "Book Live Demo" },
              { i: Award, l: "Free Consultation" },
              { i: Rocket, l: "Enterprise Inquiry" },
            ].map((c) => (
              <div key={c.l} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2">
                <c.i className="h-3.5 w-3.5 text-accent" />
                <span className="truncate text-[11px] font-semibold">{c.l}</span>
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Routing & Follow-up</div>
          </div>
          <div className="space-y-2">
            <Field label="Default assignment"><Input value="Round robin — Sales Pod" /></Field>
            <Field label="Follow-up SLA"><Input value="2 hours" mono /></Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Toggle on label="Auto assign on capture" />
              <Toggle on label="AI score every lead" />
              <Toggle on label="WhatsApp auto-ack" />
              <Toggle label="Notify owner on Slack" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-bold">Leads</div>
          <div className="flex items-center gap-1.5">
            <IconBtn icon={Users} label="Assign" tone="accent" />
            <IconBtn icon={Clock} label="Reminder" />
            <IconBtn icon={FileText} label="Notes" />
            <IconBtn icon={CheckCircle2} label="Convert" tone="success" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {LEADS.map((l) => (
            <div key={l.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
              <div className="col-span-3">
                <div className="text-sm font-bold">{l.name}</div>
                <div className="text-[11px] text-muted-foreground">{l.company} · <span className="font-mono tabular">{l.id}</span></div>
              </div>
              <div className="col-span-2"><Tone tone="info">{l.src}</Tone></div>
              <div className="col-span-2 text-[12px] text-foreground/90">{l.product}</div>
              <div className="col-span-1"><Tone tone={l.score > 80 ? "success" : l.score > 60 ? "warning" : "muted"}>{l.score}</Tone></div>
              <div className="col-span-1"><Tone tone={l.status === "Converted" ? "success" : l.status === "Qualified" ? "premium" : l.status === "Contacted" ? "info" : "muted"}>{l.status}</Tone></div>
              <div className="col-span-1 text-[11px] text-muted-foreground">{l.owner}</div>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <IconBtn icon={Phone} label="Call" />
                <IconBtn icon={Mail} label="Email" />
                <IconBtn icon={MessageSquare} label="Chat" tone="accent" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* =====================================================================
   AI CONTENT
   ===================================================================== */

export function AiContentSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · AI Content"
        title="AI Content Generator"
        description="Generate product summaries, descriptions, SEO copy, FAQs, features, benefits and use cases with a single click."
        actions={
          <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Generate All</span></PillButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Generated Today" value="182" tone="premium" />
        <StatCard label="Awaiting Review" value="24" tone="warning" />
        <StatCard label="Auto-published" value="146" tone="success" />
        <StatCard label="Rejected" value="4" tone="destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="mb-3 text-sm font-bold">Content Blocks</div>
          <div className="space-y-2">
            {["Product Summary","Short Description","Long Description","SEO Description","Meta Keywords","FAQ","Feature List","Benefits","Use Cases"].map((k) => (
              <Toggle key={k} on label={k} />
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Live Preview — Vala ERP Pro</div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Summary</div>
              <div className="rounded-lg border border-border bg-background/50 p-3 text-sm">Vala ERP Pro unifies finance, inventory, HR and CRM into one enterprise-grade suite tuned for growing Indian businesses.</div>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">FAQ</div>
              <div className="space-y-1.5">
                {[
                  "Does Vala ERP Pro support GST filing?",
                  "Can I migrate from Tally or Zoho Books?",
                  "Is there a lifetime license option?",
                ].map((q) => (
                  <div key={q} className="rounded-md border border-border bg-background/40 px-3 py-2 text-[12px]">{q}</div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</span></PillButton>
              <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve & Publish</span></PillButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   SECURITY SCAN
   ===================================================================== */

export function SecurityScanSection() {
  const scans = [
    { k: "Malware", tone: "success", v: "0 detected" },
    { k: "Dangerous Scripts", tone: "success", v: "0 detected" },
    { k: "Hidden Redirects", tone: "warning", v: "2 flagged" },
    { k: "External Tracking", tone: "warning", v: "1 flagged" },
    { k: "Fake Branding", tone: "success", v: "0 detected" },
    { k: "Copyright Violations", tone: "danger", v: "1 pending" },
    { k: "Duplicate Products", tone: "warning", v: "3 candidates" },
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Upload Security"
        title="Upload Security Scanner"
        description="Every uploaded asset is scanned for malware, malicious scripts, hidden redirects, tracking, fake branding, copyright and duplicates."
        actions={
          <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><ScanLine className="h-3.5 w-3.5" /> Run Full Scan</span></PillButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Scans Today" value="1,428" tone="premium" icon={<Radar className="h-3.5 w-3.5" />} />
        <StatCard label="Threats Blocked" value="14" tone="destructive" icon={<Bug className="h-3.5 w-3.5" />} />
        <StatCard label="Under Review" value="7" tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <StatCard label="Clean Rate" value="99.1%" tone="success" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-bold">Latest Scan — Vala ERP Pro v4.2</div>
          <div className="space-y-1.5">
            {scans.map((s) => (
              <div key={s.k} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div className="text-[12px] font-semibold">{s.k}</div>
                <Tone tone={s.tone}>{s.v}</Tone>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-bold">Scanner Configuration</div>
          <div className="space-y-2">
            <Toggle on label="Block upload on malware detection" />
            <Toggle on label="Auto-quarantine flagged files" />
            <Toggle on label="Notify author on rejection" />
            <Toggle on label="Attach SHA-256 to every asset" />
            <Toggle label="Send report to DMCA queue" />
          </div>
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
            Malicious uploads are never stored — they are hashed, logged and discarded.
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   QUALITY CHECK (PRE-PUBLISH)
   ===================================================================== */

export function QualityCheckSection() {
  const checks = [
    { k: "Thumbnail exists", ok: true },
    { k: "Demo URL configured", ok: true },
    { k: "Description ≥ 400 chars", ok: true },
    { k: "SEO complete (title/desc/keywords)", ok: true },
    { k: "Screenshots ≥ 3", ok: true },
    { k: "Latest version published", ok: false },
    { k: "Documentation uploaded", ok: false },
    { k: "Category assigned", ok: true },
    { k: "Tags ≥ 3", ok: true },
  ];
  const passing = checks.filter((c) => c.ok).length;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Publish Gate"
        title="Quality Gate — Pre-Publish Checks"
        description="Products cannot go live until every mandatory quality check passes. Manager can override with dual approval."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ready to Publish" value="146" tone="success" />
        <StatCard label="Missing Items" value="24" tone="warning" />
        <StatCard label="Blocked" value="6" tone="destructive" />
        <StatCard label="Auto Fix Rate" value="82%" tone="premium" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Vala ERP Pro — Checklist</div>
            <Tone tone={passing === checks.length ? "success" : "warning"}>{passing}/{checks.length} passed</Tone>
          </div>
          <div className="space-y-1.5">
            {checks.map((c) => (
              <div key={c.k} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div className="flex items-center gap-2 text-[12px] font-semibold">
                  {c.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  {c.k}
                </div>
                {!c.ok && <IconBtn icon={Wand2} label="Auto-fix" tone="accent" />}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Re-run</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> Publish</span></PillButton>
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-bold">Gate Policy</div>
          <div className="space-y-2">
            <Toggle on label="Block publish when any mandatory item fails" />
            <Toggle on label="Warn on optional item failure" />
            <Toggle on label="Auto-fix trivial issues (slug/tags)" />
            <Toggle label="Manager override (dual approval)" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   PRODUCT ANALYTICS
   ===================================================================== */

export function ProductAnalyticsSection() {
  const rows = [
    { name: "Vala ERP Pro", views: "48.2k", demo: "5.4k", buy: "1.2k", dl: "18.4k", conv: "3.8%", wish: "2.1k", ctr: "6.2%", bounce: "24%", session: "4m 28s", rev: "₹18.4L", trend: 92 },
    { name: "InvoiceMint", views: "22.7k", demo: "1.9k", buy: "612", dl: "6.2k", conv: "2.7%", wish: "804", ctr: "4.4%", bounce: "31%", session: "3m 12s", rev: "₹6.1L", trend: 74 },
    { name: "PixelHR", views: "14.9k", demo: "980", buy: "342", dl: "3.1k", conv: "2.3%", wish: "412", ctr: "3.8%", bounce: "38%", session: "2m 42s", rev: "₹3.4L", trend: 61 },
  ];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Product Intelligence"
        title="Per-Product Analytics"
        description="Views, demo clicks, buys, downloads, conversion, wishlist, CTR, bounce, session, geo, devices and revenue for every listing."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><DownloadCloud className="h-3.5 w-3.5" /> Export CSV</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Open Dashboard</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Views (7d)" value="128k" tone="premium" icon={<Eye className="h-3.5 w-3.5" />} />
        <StatCard label="Demo Clicks" value="14.2k" tone="default" icon={<Play className="h-3.5 w-3.5" />} />
        <StatCard label="Conversion" value="3.1%" tone="success" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <StatCard label="Bounce" value="27%" tone="warning" />
        <StatCard label="Revenue" value="₹42L" tone="premium" />
      </div>

      <Card className="p-0">
        <div className="scroll-row overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {["Product","Views","Demo","Buy","Downloads","Conv","Wishlist","CTR","Bounce","Session","Revenue","Trending"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-border/60 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-bold">{r.name}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.views}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.demo}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.buy}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.dl}</td>
                  <td className="px-4 py-3 font-mono tabular text-success">{r.conv}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.wish}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.ctr}</td>
                  <td className="px-4 py-3 font-mono tabular text-warning">{r.bounce}</td>
                  <td className="px-4 py-3 font-mono tabular">{r.session}</td>
                  <td className="px-4 py-3 font-mono tabular text-premium">{r.rev}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent to-premium" style={{ width: `${r.trend}%` }} />
                      </div>
                      <span className="font-mono text-[11px] tabular">{r.trend}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center gap-2"><Globe2 className="h-4 w-4 text-accent" /><div className="text-sm font-bold">Top Countries</div></div>
          {[
            ["India", 62],["USA", 14],["UAE", 8],["UK", 6],["Singapore", 4],
          ].map(([c, p]) => (
            <div key={c as string} className="mb-2">
              <div className="flex justify-between text-[11px]"><span>{c}</span><span className="font-mono tabular text-muted-foreground">{p}%</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: `${p}%` }} /></div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-accent" /><div className="text-sm font-bold">Top Devices</div></div>
          {[
            ["Desktop", 58],["Mobile", 34],["Tablet", 8],
          ].map(([c, p]) => (
            <div key={c as string} className="mb-2">
              <div className="flex justify-between text-[11px]"><span>{c}</span><span className="font-mono tabular text-muted-foreground">{p}%</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-premium" style={{ width: `${p}%` }} /></div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><Search className="h-4 w-4 text-accent" /><div className="text-sm font-bold">Search Ranking</div></div>
          <div className="space-y-1.5">
            {[["vala erp", 2],["invoice software", 4],["hr suite india", 6],["ai ticket router", 3]].map(([k, r]) => (
              <div key={k as string} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
                <div className="text-[12px]">{k}</div>
                <Tone tone={(r as number) <= 3 ? "success" : "warning"}>#{r as number}</Tone>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
   AUDIT / ACTIVITY / VERSIONING
   ===================================================================== */

const AUDIT = [
  { t: "now", actor: "Boss", act: "Approved product", target: "Vala ERP Pro v4.2", tone: "success" as const },
  { t: "12m", actor: "System", act: "Auto-scanned upload", target: "invoicemint-v2.1.zip", tone: "info" as const },
  { t: "42m", actor: "Riya", act: "Rejected submission", target: "PixelHR (branding violation)", tone: "danger" as const },
  { t: "1h", actor: "Boss", act: "Scheduled publish", target: "TicketRouter AI · tomorrow 09:00", tone: "premium" as const },
  { t: "2h", actor: "System", act: "Auto backup", target: "marketplace-snapshot-#8842", tone: "info" as const },
  { t: "3h", actor: "Aman", act: "Rolled back", target: "Vala ERP Pro → v4.1", tone: "warning" as const },
];

export function AuditLogSection() {
  const [tab, setTab] = useState("Activity");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · Audit & History"
        title="Activity, Audit & Version History"
        description="Every change is versioned and reversible — scheduled publish, rollback, auto backup, import, export and full bulk operations."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</span></PillButton>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><DownloadCloud className="h-3.5 w-3.5" /> Export</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Snapshot Now</span></PillButton>
          </>
        }
      />
      <SubNav items={["Activity", "Audit Log", "Version History", "Scheduled", "Backups", "Approvals"]} active={tab} onChange={setTab} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Events Today" value="1,284" tone="premium" icon={<History className="h-3.5 w-3.5" />} />
        <StatCard label="Scheduled" value="18" tone="warning" icon={<Calendar className="h-3.5 w-3.5" />} />
        <StatCard label="Backups (30d)" value="42" tone="success" icon={<Save className="h-3.5 w-3.5" />} />
        <StatCard label="Rollbacks" value="6" tone="default" icon={<RotateCcw className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-bold">Activity Timeline</div>
          <div className="divide-y divide-border">
            {AUDIT.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full shadow-[0_0_6px_currentColor] ${a.tone === "success" ? "bg-emerald-400 text-emerald-400" : a.tone === "warning" ? "bg-amber-400 text-amber-400" : a.tone === "danger" ? "bg-destructive text-destructive" : a.tone === "premium" ? "bg-premium text-premium" : "bg-accent text-accent"}`} />
                <div className="flex-1">
                  <div className="text-[12px]"><span className="font-bold">{a.actor}</span> <span className="text-muted-foreground">{a.act}</span> <span className="font-semibold">{a.target}</span></div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.t} ago</div>
                </div>
                <IconBtn icon={Eye} label="Details" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><GitBranch className="h-4 w-4 text-accent" /><div className="text-sm font-bold">Version History — Vala ERP Pro</div></div>
          <div className="space-y-2">
            {[
              { v: "v4.2", d: "today", who: "Boss", cur: true },
              { v: "v4.1", d: "3d ago", who: "Riya" },
              { v: "v4.0", d: "12d ago", who: "Boss" },
              { v: "v3.9", d: "1mo ago", who: "System" },
            ].map((v) => (
              <div key={v.v} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${v.cur ? "border-accent/40 bg-accent/10" : "border-border bg-background/40"}`}>
                <div>
                  <div className="text-[12px] font-bold">{v.v} {v.cur && <Tone tone="success">Current</Tone>}</div>
                  <div className="text-[10px] text-muted-foreground">{v.d} · {v.who}</div>
                </div>
                <div className="flex gap-1">
                  <IconBtn icon={Eye} label="Diff" />
                  {!v.cur && <IconBtn icon={RotateCcw} label="Rollback" tone="accent" />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-warning" /><div className="text-sm font-bold">Scheduled Publish / Unpublish</div></div>
          <div className="space-y-1.5">
            {[
              { name: "TicketRouter AI", when: "Tomorrow 09:00 IST", act: "Publish" },
              { name: "Holiday Sale Banner", when: "Fri 00:00 IST", act: "Publish" },
              { name: "PixelHR Beta", when: "Mon 22:00 IST", act: "Unpublish" },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div>
                  <div className="text-[12px] font-bold">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.when}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Tone tone={s.act === "Publish" ? "success" : "warning"}>{s.act}</Tone>
                  <IconBtn icon={XCircle} label="Cancel" tone="danger" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><Save className="h-4 w-4 text-success" /><div className="text-sm font-bold">Backups & Restore</div></div>
          <div className="space-y-1.5">
            {[
              { id: "snap-8842", when: "today 14:20", size: "142 MB" },
              { id: "snap-8841", when: "today 02:00", size: "141 MB" },
              { id: "snap-8840", when: "yesterday 02:00", size: "140 MB" },
            ].map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div>
                  <div className="font-mono text-[12px] tabular font-bold">{b.id}</div>
                  <div className="text-[10px] text-muted-foreground">{b.when} · {b.size}</div>
                </div>
                <div className="flex gap-1">
                  <IconBtn icon={DownloadCloud} label="Download" />
                  <IconBtn icon={RotateCcw} label="Restore" tone="accent" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Toggle on label="Nightly auto-backup 02:00 IST" />
          </div>
        </Card>
      </div>
    </div>
  );
}
