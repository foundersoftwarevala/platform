/**
 * The Control Panel cockpit: who may see it, what the database sends, and how
 * each figure becomes a tile.
 *
 * The figures are counted by control_panel_cockpit() on the database and
 * served by /api/control-panel/cockpit. Nothing here invents a value: a figure
 * the platform does not record is shown as "—" and says it is not tracked.
 */

/**
 * The roles the Control Panel page admits: its own four, and the platform
 * operators RequireRole always lets through. The API checks the same list, so
 * the page and the figures behind it cannot disagree about who is let in.
 */
export const COCKPIT_ROLES = [
  "developer",
  "finance",
  "support",
  "sales_support_manager",
  "boss",
  "boss_owner",
  "admin",
  "super_admin",
  "founder",
  "owner",
] as const;

type Money = Record<string, number>;

export type CockpitFigures = {
  computed_at: string;
  revenue_total: Money;
  revenue_month: Money;
  revenue_last_month: Money;
  revenue_today: Money;
  paid_orders: number;
  paid_orders_series: number[];
  accounts: number;
  accounts_seen_30d: number;
  franchises_total: number;
  franchises_active: number;
  franchises_pending: number;
  franchise_countries: number;
  franchise_continents: number;
  franchise_top_continent: string | null;
  royalty_due: number;
  royalty_records: number;
  servers_total: number;
  servers_up: number;
  servers_healthy: number;
  uptime_avg: number | null;
  storage_gb: number | null;
  latest_metrics: { cpu: number | null; ram: number | null; disk: number | null; recorded_at: string | null } | null;
  cpu_series: number[];
  ram_series: number[];
  server_alerts_open: number;
  events_hour: number;
  events_series: number[];
  demo_clicks_30d: number;
  deploy_requests: number;
  legal_approvals: number;
  latest_deployment: { status: string; at: string } | null;
  tasks_open: number;
  tasks_completed_today: number;
  tasks_due_today: number;
  tasks_due_week: number;
  tasks_due_done: number;
  tasks_on_time: number;
  jobs_running: number;
  jobs_queued: number;
  jobs_oldest_queued: string | null;
  jobs_dead: number;
  tickets_open: number;
  tickets_resolved_today: number;
  csat_avg: number | null;
  csat_count: number;
  products_total: number;
  products_live: number;
  demos_active: number;
  demos_reachable: number;
  demos_checked: number;
  demo_requests: number;
  demo_requests_pending: number;
  demo_requests_approved: number;
  master_wallet: { balance: number; currency: string } | null;
  inflow_month: number;
  outflow_month: number;
  finance_last_txn: string | null;
  alerts: { critical: number; warning: number; info: number };
  /** Open role applications, from the application registry. Null if it could not be read. */
  role_applications: number | null;
};

export type TileStatus = "healthy" | "warning" | "critical" | "action" | "untracked";

export type Tile = {
  value: string;
  subValues: string[];
  status: TileStatus;
  /** A real history for the sparkline, oldest first. Absent where none is kept. */
  series?: number[];
  /** A real comparison. Absent where there is nothing to compare with. */
  trend?: { up: boolean; text: string };
};

/**
 * Finance transactions and royalties carry no currency of their own, so - as in
 * the Finance ledger - their amounts are shown as numbers, without a symbol.
 */
const count = (n: number) => new Intl.NumberFormat("en-IN").format(n);

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${count(Math.round(amount))} ${currency}`;
  }
}

/** Sums in several currencies are shown side by side, never converted. */
function moneyOf(sums: Money): string {
  const entries = Object.entries(sums ?? {}).filter(([, v]) => Number.isFinite(Number(v)));
  if (!entries.length) return "0";
  return entries.map(([currency, v]) => money(Number(v), currency)).join(" + ");
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

const untracked = (why: string): Tile => ({ value: "—", subValues: [why], status: "untracked" });

const pct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? "—" : `${Number(n).toFixed(Number(n) % 1 ? 1 : 0)}%`;

function load(n: number | null | undefined): TileStatus {
  if (n == null) return "untracked";
  if (n >= 90) return "critical";
  if (n >= 75) return "warning";
  return "healthy";
}

/** Month on month, only where both months are in the same single currency. */
function growth(f: CockpitFigures): Tile {
  const now = Object.entries(f.revenue_month ?? {});
  const before = Object.entries(f.revenue_last_month ?? {});
  if (before.length !== 1 || now.length > 1 || (now[0] && now[0][0] !== before[0][0])) {
    return {
      value: "—",
      subValues: [before.length ? "Months are in different currencies" : "No paid orders last month to compare"],
      status: "untracked",
    };
  }
  const last = Number(before[0][1]);
  const current = Number(now[0]?.[1] ?? 0);
  if (!last) return untracked("No paid orders last month to compare");
  const change = ((current - last) / last) * 100;
  return {
    value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    subValues: ["Paid revenue, month on month"],
    status: change >= 0 ? "healthy" : "warning",
    trend: { up: change >= 0, text: `${Math.abs(change).toFixed(1)}%` },
  };
}

export function cockpitTiles(f: CockpitFigures): Record<string, Tile> {
  const m = f.latest_metrics;
  const roleApps = f.role_applications;
  const approvals = (roleApps ?? 0) + f.deploy_requests + f.legal_approvals;
  const openAlerts = f.alerts.critical + f.alerts.warning + f.alerts.info;
  const net = f.inflow_month - f.outflow_month;
  const queuedMinutes = f.jobs_oldest_queued
    ? Math.floor((Date.now() - new Date(f.jobs_oldest_queued).getTime()) / 60_000)
    : 0;
  const wallet = f.master_wallet;

  return {
    revenue: {
      value: moneyOf(f.revenue_total),
      subValues: [`${count(f.paid_orders)} paid orders`],
      status: "healthy",
      series: f.paid_orders_series,
    },
    growth: growth(f),
    users: {
      value: count(f.accounts_seen_30d),
      subValues: [`Seen in 30 days · ${count(f.accounts)} accounts`],
      status: "healthy",
    },
    countries: {
      value: count(f.franchise_countries),
      subValues: ["Where a franchise operates"],
      status: "healthy",
    },
    franchises: {
      value: count(f.franchises_total),
      subValues: [`${count(f.franchises_active)} active, ${count(f.franchises_pending)} pending`],
      status: f.franchises_pending ? "warning" : "healthy",
    },
    "server-status": f.servers_total
      ? {
          value: f.servers_up === f.servers_total ? "ONLINE" : `${f.servers_up}/${f.servers_total} UP`,
          subValues: [`${f.servers_healthy} of ${f.servers_total} reporting healthy`],
          status:
            f.servers_up < f.servers_total
              ? "critical"
              : f.servers_healthy < f.servers_total
                ? "warning"
                : "healthy",
        }
      : untracked("No server is registered"),
    uptime:
      f.uptime_avg == null
        ? untracked("No uptime recorded")
        : { value: pct(f.uptime_avg), subValues: ["As recorded on the server"], status: f.uptime_avg >= 99.5 ? "healthy" : "warning" },
    "cpu-load":
      m?.cpu == null
        ? untracked("No server reading yet")
        : { value: pct(m.cpu), subValues: [`Latest reading ${relative(m.recorded_at)}`], status: load(m.cpu), series: f.cpu_series },
    ram:
      m?.ram == null
        ? untracked("No server reading yet")
        : { value: pct(m.ram), subValues: [`Latest reading ${relative(m.recorded_at)}`], status: load(m.ram), series: f.ram_series },
    storage:
      m?.disk == null
        ? untracked("No server reading yet")
        : {
            value: pct(m.disk),
            subValues: [f.storage_gb ? `${count(f.storage_gb)} GB provisioned` : "Disk in use"],
            status: load(m.disk),
          },
    "live-activity": {
      value: count(f.events_hour),
      subValues: ["Marketplace events in the last hour"],
      status: "action",
      series: f.events_series,
    },
    approvals: {
      value: roleApps == null ? "—" : count(approvals),
      subValues: [
        `${roleApps == null ? "?" : count(roleApps)} role · ${count(f.deploy_requests)} deploy · ${count(f.legal_approvals)} legal`,
      ],
      status: roleApps == null ? "untracked" : approvals ? "action" : "healthy",
    },
    "role-approvals":
      roleApps == null
        ? untracked("Applications could not be read")
        : { value: count(roleApps), subValues: ["Applications awaiting a decision"], status: roleApps ? "action" : "healthy" },
    "deploy-approvals": {
      value: count(f.deploy_requests),
      subValues: [f.deploy_requests ? "Waiting for approval" : "No deployment waiting"],
      status: f.deploy_requests ? "warning" : "healthy",
    },
    "completed-today": {
      value: count(f.tasks_completed_today),
      subValues: ["Tasks completed today (IST)"],
      status: "healthy",
    },
    "active-tasks": {
      value: count(f.tasks_open),
      subValues: ["Open in the Task Manager"],
      status: f.tasks_open ? "action" : "healthy",
    },
    performance: f.tasks_due_done
      ? {
          value: pct((f.tasks_on_time / f.tasks_due_done) * 100),
          subValues: [`${count(f.tasks_on_time)} of ${count(f.tasks_due_done)} tasks done by their deadline`],
          status: f.tasks_on_time / f.tasks_due_done >= 0.8 ? "healthy" : "warning",
        }
      : untracked("No completed task had a deadline"),
    "ai-jobs": {
      value: count(f.jobs_running),
      subValues: [`Running now · ${count(f.jobs_dead)} dead-lettered`],
      status: f.jobs_dead ? "warning" : "action",
    },
    "ai-queue": {
      value: count(f.jobs_queued),
      subValues: [f.jobs_queued ? `Oldest waiting ${relative(f.jobs_oldest_queued)}` : "Nothing waiting"],
      status: f.jobs_queued && queuedMinutes > 15 ? "warning" : "healthy",
    },
    "clone-status": untracked("No clone record is kept"),
    "deploy-status": f.latest_deployment
      ? {
          value: f.latest_deployment.status.toUpperCase(),
          subValues: [`Last deployment ${relative(f.latest_deployment.at)}`],
          status: /fail|error/i.test(f.latest_deployment.status) ? "critical" : "healthy",
        }
      : untracked("No deployment recorded"),
    "server-alerts": {
      value: count(f.server_alerts_open),
      subValues: [f.server_alerts_open ? "Unresolved" : "None open"],
      status: f.server_alerts_open ? "critical" : "healthy",
    },
    continents: {
      value: count(f.franchise_continents),
      subValues: [f.franchise_top_continent ? `Top region: ${f.franchise_top_continent}` : "No franchise located yet"],
      status: "healthy",
    },
    risk: untracked("No regional risk score is kept"),
    compliance: untracked("No compliance record is kept yet"),
    "franchise-active": {
      value: count(f.franchises_active),
      subValues: [`${count(f.franchises_pending)} onboarding`],
      status: "healthy",
    },
    "revenue-share": {
      value: count(Math.round(f.royalty_due)),
      subValues: [`Royalty due · ${count(f.royalty_records)} records`],
      status: "healthy",
    },
    tickets: {
      value: count(f.tickets_open),
      subValues: [`${count(f.tickets_resolved_today)} resolved today`],
      status: f.tickets_open ? "warning" : "healthy",
    },
    "today-revenue": {
      value: moneyOf(f.revenue_today),
      subValues: ["Paid orders today (IST)"],
      status: "healthy",
    },
    csat:
      f.csat_count && f.csat_avg != null
        ? { value: `${f.csat_avg}/5`, subValues: [`${count(f.csat_count)} ratings`], status: f.csat_avg >= 4 ? "healthy" : "warning" }
        : untracked("No customer has rated a ticket yet"),
    products: {
      value: count(f.products_total),
      subValues: [`${count(f.products_live)} live · ${count(f.products_total - f.products_live)} not live`],
      status: "healthy",
    },
    "update-requests": untracked("No product update request is recorded"),
    demos: {
      value: count(f.demos_active),
      subValues: [`${count(f.demo_requests_pending)} demo requests pending`],
      status: f.demo_requests_pending ? "action" : "healthy",
    },
    conversion: f.demo_requests
      ? {
          value: pct((f.demo_requests_approved / f.demo_requests) * 100),
          subValues: [`${count(f.demo_requests_approved)} of ${count(f.demo_requests)} demo requests approved`],
          status: "healthy",
        }
      : untracked(`No demo request yet · ${count(f.demo_clicks_30d)} demo clicks in 30 days`),
    "live-software": {
      value: count(f.demos_reachable),
      subValues: [`of ${count(f.demos_checked)} demos answered at last check`],
      status: f.demos_reachable < f.demos_checked ? "warning" : "healthy",
    },
    wallet: wallet
      ? { value: money(Number(wallet.balance), wallet.currency), subValues: ["Master wallet"], status: "healthy" }
      : untracked("No master wallet exists"),
    inflow: {
      value: count(Math.round(f.inflow_month)),
      subValues: [`Credits this month · last entry ${relative(f.finance_last_txn)}`],
      status: "healthy",
    },
    outflow: {
      value: count(Math.round(f.outflow_month)),
      subValues: ["Debits this month"],
      status: "healthy",
    },
    "net-profit": {
      value: `${net >= 0 ? "+" : "−"}${count(Math.round(Math.abs(net)))}`,
      subValues: ["Inflow minus outflow, this month"],
      status: net >= 0 ? "healthy" : "warning",
    },
    alerts: {
      value: count(openAlerts),
      subValues: [`${count(f.alerts.critical)} critical · ${count(f.alerts.warning)} warning · ${count(f.alerts.info)} info`],
      status: f.alerts.critical ? "critical" : f.alerts.warning ? "warning" : "healthy",
    },
  };
}
