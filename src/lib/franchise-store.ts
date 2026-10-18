// Franchise network data layer: branches, leads pipeline, employees, payments.
//
// This used to open on generated data - 26 leads, 34 employees, 18 payments
// from a random-number generator - and fell back to it whenever the tables
// were empty or a read failed, so a franchise owner could not tell their real
// network from an invented one. It also read every franchise's rows, not the
// signed-in franchise's, and every create, edit and delete changed only the
// browser's memory.
//
// Now: the franchise is the one the signed-in person owns or belongs to; its
// branches, leads, employees and royalties are read from the franchise tables
// and nothing is generated. Changes are shown at once and written to the table,
// and a refusal is shown and the rows read again. Royalties are read only - the
// database lets only franchise administrators and finance change them. The
// revenue charts are the franchise's own monthly performance.

import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export type BranchStatus = "active" | "onboarding" | "paused" | "closed";
export type Branch = {
  id: string;
  name: string;
  city: string;
  region: string;
  manager: string;
  status: BranchStatus;
  openedAt: string;
  employees: number;
  /** Total sales recorded against the branch. */
  monthlyRevenue: number;
  /** No sales target is recorded for a branch; kept for the screen, always null. */
  target: number | null;
  rating: number;
  /** No per-branch history is kept, so this is empty. */
  trend: number[];
};

export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export type Lead = {
  id: string;
  name: string;
  company: string;
  city: string;
  owner: string;
  stage: LeadStage;
  value: number;
  source: string;
  createdAt: string;
  notes: string;
};

export type EmployeeStatus = "active" | "probation" | "leave" | "exited";
export type Employee = {
  id: string;
  name: string;
  role: string;
  branch: string;
  status: EmployeeStatus;
  joinedAt: string;
  performance: number;
  email: string;
  availability: boolean[];
};

export type Payment = {
  id: string;
  branch: string;
  invoice: string;
  amount: number;
  commission: number;
  status: "paid" | "pending" | "overdue";
  date: string;
};

type State = {
  loading: boolean;
  error: string | null;
  /** Why there is nothing to show, when there is nothing. */
  note: string | null;
  franchiseIds: string[];
  branches: Branch[];
  leads: Lead[];
  employees: Employee[];
  payments: Payment[];
  /** The franchise's recorded revenue, one point per period, oldest first. */
  revenueByPeriod: { label: string; value: number }[];
};

const EMPTY: State = {
  loading: true, error: null, note: null, franchiseIds: [],
  branches: [], leads: [], employees: [], payments: [], revenueByPeriod: [],
};

// The franchise tables are not all in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: string) => (supabase as any).from(t);

function asNumber(value: unknown, fallback = 0) {
  const result = Number(value ?? fallback);
  return Number.isFinite(result) ? result : fallback;
}

type Row = Record<string, unknown>;

function mapBranch(row: Row): Branch {
  return {
    id: String(row.id),
    name: String(row.name ?? "Branch"),
    city: String(row.city ?? ""),
    region: String(row.region ?? ""),
    manager: String(row.manager ?? "Unassigned"),
    status: (row.status as BranchStatus) ?? "active",
    openedAt: String(row.joined_date ?? row.created_at ?? ""),
    employees: Math.max(0, Math.round(asNumber(row.active_employees, 0))),
    monthlyRevenue: asNumber(row.total_sales, 0),
    target: null,
    rating: Number((asNumber(row.performance_score, 0) / 20).toFixed(1)),
    trend: [],
  };
}

function mapLead(row: Row): Lead {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    company: String(row.company ?? "—"),
    city: "",
    owner: String(row.owner_user_id ? "you" : "—"),
    stage: (row.stage as LeadStage) ?? "new",
    value: asNumber(row.value, 0),
    source: String(row.source ?? ""),
    createdAt: String(row.created_at ?? ""),
    notes: String(row.notes ?? ""),
  };
}

function mapEmployee(row: Row, branchName: Map<string, string>): Employee {
  return {
    id: String(row.id),
    name: String(row.full_name ?? ""),
    role: String(row.role ?? ""),
    branch: branchName.get(String(row.branch_id ?? "")) ?? "—",
    status: (row.status as EmployeeStatus) ?? "active",
    joinedAt: String(row.joined_at ?? row.created_at ?? ""),
    performance: Math.max(0, Math.min(100, asNumber(row.performance, 0))),
    email: String(row.email ?? ""),
    availability: Array.isArray(row.availability)
      ? (row.availability as unknown[]).map((v) => Boolean(v))
      : [false, false, false, false, false, false, false],
  };
}

function mapPayment(row: Row): Payment {
  const status = String(row.status ?? "pending");
  const due = row.due_date ? new Date(String(row.due_date)).getTime() : null;
  return {
    id: String(row.id),
    branch: String(row.period ?? ""),
    invoice: `ROY-${String(row.id).slice(0, 8).toUpperCase()}`,
    amount: asNumber(row.royalty_due, 0),
    commission: asNumber(row.commission_due, 0),
    status: status === "paid" ? "paid" : due != null && due < Date.now() ? "overdue" : "pending",
    date: String(row.due_date ?? row.created_at ?? ""),
  };
}

let state: State = EMPTY;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((listener) => listener()); }
function setState(patch: Partial<State>) { state = { ...state, ...patch }; emit(); }

async function rows(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function load(): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setState({ ...EMPTY, loading: false, note: "Please sign in to see your franchise." });
      return;
    }
    const [owned, member] = await Promise.all([
      rows(from("franchises").select("id").eq("owner_user_id", uid)),
      rows(from("franchise_users").select("franchise_id").eq("user_id", uid).eq("active", true)),
    ]);
    const franchiseIds = [...new Set([...owned.map((f) => String(f.id)), ...member.map((m) => String(m.franchise_id))])];
    if (!franchiseIds.length) {
      setState({ ...EMPTY, loading: false, note: "No franchise is linked to this account yet." });
      return;
    }
    const [branches, leads, employees, royalties, performance] = await Promise.all([
      rows(from("franchise_branches").select("*").in("franchise_id", franchiseIds).order("created_at", { ascending: false })),
      rows(from("franchise_leads").select("*").in("franchise_id", franchiseIds).order("created_at", { ascending: false })),
      rows(from("franchise_employees").select("*").in("franchise_id", franchiseIds).order("created_at", { ascending: false })),
      rows(from("franchise_royalties").select("*").in("franchise_id", franchiseIds).order("created_at", { ascending: false })),
      rows(from("franchise_performance").select("period,revenue").in("franchise_id", franchiseIds).order("period")),
    ]);
    const branchName = new Map(branches.map((b) => [String(b.id), String(b.name ?? "")]));
    const byPeriod = new Map<string, number>();
    for (const p of performance) byPeriod.set(String(p.period), (byPeriod.get(String(p.period)) ?? 0) + asNumber(p.revenue, 0));
    setState({
      loading: false,
      error: null,
      note: null,
      franchiseIds,
      branches: branches.map(mapBranch),
      leads: leads.map(mapLead),
      employees: employees.map((e) => mapEmployee(e, branchName)),
      payments: royalties.map(mapPayment),
      revenueByPeriod: [...byPeriod.entries()].slice(-12).map(([label, value]) => ({ label, value })),
    });
  } catch (error) {
    setState({ loading: false, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Writes one change; a refusal is shown and the rows are read again. */
async function write(what: string, run: () => PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await run();
  if (error) {
    toast.error(`${what} was not saved: ${error.message}`);
    await load();
    return false;
  }
  return true;
}

/** Typing in a field writes once the typing stops, not on every keystroke. */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
function later(key: string, run: () => void) {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  pending.set(key, setTimeout(() => { pending.delete(key); run(); }, 500));
}

function branchColumns(input: Partial<Branch>): Row {
  const out: Row = {};
  if (input.name !== undefined) out.name = input.name.trim() || "Branch";
  if (input.city !== undefined) out.city = input.city;
  if (input.region !== undefined) out.region = input.region;
  if (input.manager !== undefined) out.manager = input.manager;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

function leadColumns(input: Partial<Lead>): Row {
  const out: Row = {};
  if (input.name !== undefined) out.name = input.name.trim() || "Lead";
  if (input.company !== undefined) out.company = input.company;
  if (input.stage !== undefined) out.stage = input.stage;
  if (input.value !== undefined) out.value = input.value;
  if (input.source !== undefined) out.source = input.source;
  if (input.notes !== undefined) out.notes = input.notes;
  return out;
}

function employeeColumns(input: Partial<Employee>): Row {
  const out: Row = {};
  if (input.name !== undefined) out.full_name = input.name.trim() || "Employee";
  if (input.role !== undefined) out.role = input.role;
  if (input.email !== undefined) out.email = input.email;
  if (input.status !== undefined) out.status = input.status;
  if (input.performance !== undefined) out.performance = input.performance;
  if (input.availability !== undefined) out.availability = input.availability;
  if (input.branch !== undefined) {
    out.branch_id = state.branches.find((b) => b.name === input.branch || b.id === input.branch)?.id ?? null;
  }
  return out;
}

export function useFranchise() {
  const snap = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => EMPTY,
  );

  useEffect(() => {
    void load();
  }, []);

  const franchiseId = () => {
    const id = state.franchiseIds[0];
    if (!id) toast.error("No franchise is linked to this account, so nothing can be added.");
    return id;
  };

  return {
    ...snap,
    reload: load,
    /* branches */
    async createBranch(input: Partial<Branch>) {
      const id = franchiseId();
      if (!id) return;
      if (await write("The branch", () => from("franchise_branches").insert({
        ...branchColumns({ status: "onboarding", ...input }),
        franchise_id: id,
        joined_date: new Date().toISOString().slice(0, 10),
      }))) {
        toast.success("Branch added");
        await load();
      }
    },
    updateBranch(id: string, patch: Partial<Branch>) {
      setState({ branches: state.branches.map((b) => (b.id === id ? { ...b, ...patch, target: null } : b)) });
      later(`branch:${id}`, () => void write("The branch", () => from("franchise_branches").update(branchColumns(patch)).eq("id", id)));
    },
    async removeBranches(ids: string[]) {
      if (!window.confirm(`Delete ${ids.length === 1 ? "this branch" : `${ids.length} branches`}?`)) return;
      setState({ branches: state.branches.filter((b) => !ids.includes(b.id)) });
      if (await write("Deleting", () => from("franchise_branches").delete().in("id", ids))) toast.success("Deleted");
    },
    /* leads */
    async createLead(input: Partial<Lead>) {
      const id = franchiseId();
      if (!id) return;
      const { data: auth } = await supabase.auth.getUser();
      if (await write("The lead", () => from("franchise_leads").insert({
        ...leadColumns({ stage: "new", ...input }),
        franchise_id: id,
        owner_user_id: auth.user?.id ?? null,
      }))) {
        toast.success("Lead added");
        await load();
      }
    },
    updateLead(id: string, patch: Partial<Lead>) {
      setState({ leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
      later(`lead:${id}`, () => void write("The lead", () => from("franchise_leads").update(leadColumns(patch)).eq("id", id)));
    },
    async removeLead(id: string) {
      if (!window.confirm("Delete this lead?")) return;
      setState({ leads: state.leads.filter((l) => l.id !== id) });
      if (await write("Deleting", () => from("franchise_leads").delete().eq("id", id))) toast.success("Deleted");
    },
    /* employees */
    async createEmployee(input: Partial<Employee>) {
      const id = franchiseId();
      if (!id) return;
      if (await write("The employee", () => from("franchise_employees").insert({
        ...employeeColumns({ status: "probation", ...input }),
        franchise_id: id,
        joined_at: new Date().toISOString(),
      }))) {
        toast.success("Employee added");
        await load();
      }
    },
    updateEmployee(id: string, patch: Partial<Employee>) {
      setState({ employees: state.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
      later(`employee:${id}`, () => void write("The employee", () => from("franchise_employees").update(employeeColumns(patch)).eq("id", id)));
    },
    async removeEmployees(ids: string[]) {
      if (!window.confirm(`Delete ${ids.length === 1 ? "this employee" : `${ids.length} employees`}?`)) return;
      setState({ employees: state.employees.filter((e) => !ids.includes(e.id)) });
      if (await write("Deleting", () => from("franchise_employees").delete().in("id", ids))) toast.success("Deleted");
    },
    async importEmployees(rowsIn: Partial<Employee>[]) {
      const id = franchiseId();
      if (!id || !rowsIn.length) return 0;
      const ok = await write("The import", () => from("franchise_employees").insert(
        rowsIn.map((p) => ({
          ...employeeColumns({ status: "probation", ...p, name: String(p.name ?? "Employee") }),
          franchise_id: id,
          joined_at: p.joinedAt ?? new Date().toISOString(),
        })),
      ));
      if (!ok) return 0;
      await load();
      toast.success(`Imported ${rowsIn.length} employee${rowsIn.length === 1 ? "" : "s"}`);
      return rowsIn.length;
    },
  };
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
