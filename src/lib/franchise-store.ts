// Franchise network data layer: branches, leads pipeline, employees, payments.
// In-memory store with realistic seeded sample data + full CRUD, shared across
// modules through useSyncExternalStore.

import { useSyncExternalStore } from "react";
import { pickFrom, rng } from "./metrics";

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
  monthlyRevenue: number;
  target: number;
  rating: number;
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
  performance: number; // 0-100
  email: string;
  availability: boolean[]; // 7 days
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

type State = { branches: Branch[]; leads: Lead[]; employees: Employee[]; payments: Payment[] };

const CITIES: [string, string][] = [
  ["Mumbai", "West"], ["Pune", "West"], ["Delhi", "North"], ["Gurugram", "North"],
  ["Bengaluru", "South"], ["Chennai", "South"], ["Hyderabad", "South"],
  ["Kolkata", "East"], ["Ahmedabad", "West"], ["Jaipur", "North"], ["Indore", "Central"],
  ["Lucknow", "North"],
];
const PEOPLE = [
  "Aarav Mehta", "Priya Shah", "Rohit Verma", "Maya Patel", "Noah Singh", "Ava Khan",
  "Kabir Rao", "Zoya Iyer", "Ishaan Gupta", "Neha Kulkarni", "Arjun Nair", "Sara Sheikh",
];
const SOURCES = ["Website", "Referral", "Expo", "Cold call", "Paid ads", "Partner"];
const JOB_ROLES = ["Branch Manager", "Sales Executive", "Support Agent", "Trainer", "Operations Lead", "Accountant"];

function uid() { return Math.random().toString(36).slice(2, 9); }
function iso(daysAgo: number) { return new Date(Date.now() - daysAgo * 864e5).toISOString(); }

function seedTrend(seed: string) {
  const r = rng(seed);
  let v = 60 + r() * 40;
  return Array.from({ length: 12 }, () => {
    v = Math.max(20, Math.min(140, v + (r() - 0.45) * 22));
    return Math.round(v);
  });
}

function seed(): State {
  const r = rng("franchise-network-v1");
  const branches: Branch[] = CITIES.map(([city, region], i) => {
    const rev = Math.round(180_000 + r() * 920_000);
    return {
      id: `BR-${String(101 + i)}`,
      name: `${city} ${pickFrom(r, ["Central", "Hub", "Flagship", "Express", "Prime"])}`,
      city, region,
      manager: PEOPLE[i % PEOPLE.length],
      status: i === 10 ? "onboarding" : i === 11 ? "paused" : "active",
      openedAt: iso(Math.round(120 + r() * 1200)),
      employees: Math.round(6 + r() * 28),
      monthlyRevenue: rev,
      target: Math.round(rev * (0.8 + r() * 0.5)),
      rating: Math.round((3.6 + r() * 1.4) * 10) / 10,
      trend: seedTrend(`branch-${city}`),
    };
  });

  const leads: Lead[] = Array.from({ length: 26 }, (_, i) => {
    const [city] = CITIES[i % CITIES.length];
    return {
      id: `LD-${1001 + i}`,
      name: PEOPLE[(i * 5) % PEOPLE.length],
      company: `${city} ${pickFrom(r, ["Ventures", "Retail", "Enterprises", "Traders", "Group", "Labs"])}`,
      city,
      owner: PEOPLE[(i * 3) % PEOPLE.length],
      stage: LEAD_STAGES[i % LEAD_STAGES.length],
      value: Math.round(45_000 + r() * 640_000),
      source: pickFrom(r, SOURCES),
      createdAt: iso(Math.round(1 + r() * 90)),
      notes: "",
    };
  });

  const employees: Employee[] = Array.from({ length: 34 }, (_, i) => {
    const b = branches[i % branches.length];
    return {
      id: `EM-${2001 + i}`,
      name: PEOPLE[(i * 7) % PEOPLE.length],
      role: JOB_ROLES[i % JOB_ROLES.length],
      branch: b.name,
      status: i % 11 === 0 ? "probation" : i % 17 === 0 ? "leave" : "active",
      joinedAt: iso(Math.round(30 + r() * 900)),
      performance: Math.round(52 + r() * 46),
      email: `${PEOPLE[(i * 7) % PEOPLE.length].toLowerCase().replace(/\s+/g, ".")}@softwarevala.com`,
      availability: Array.from({ length: 7 }, (_, d) => d < 5 || r() > 0.6),
    };
  });

  const payments: Payment[] = Array.from({ length: 18 }, (_, i) => {
    const b = branches[i % branches.length];
    const amount = Math.round(30_000 + r() * 420_000);
    return {
      id: `PM-${3001 + i}`,
      branch: b.name,
      invoice: `INV-2026-${String(400 + i)}`,
      amount,
      commission: Math.round(amount * 0.12),
      status: i % 7 === 0 ? "overdue" : i % 3 === 0 ? "pending" : "paid",
      date: iso(Math.round(1 + r() * 120)),
    };
  });

  return { branches, leads, employees, payments };
}

let state: State = seed();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function setState(patch: Partial<State>) { state = { ...state, ...patch }; emit(); }

export function useFranchise() {
  const snap = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );

  return {
    ...snap,
    /* branches */
    createBranch(input: Partial<Branch>) {
      const b: Branch = {
        id: `BR-${uid().toUpperCase().slice(0, 4)}`,
        name: input.name?.trim() || "New Branch",
        city: input.city || "Mumbai",
        region: input.region || "West",
        manager: input.manager || "Unassigned",
        status: input.status || "onboarding",
        openedAt: input.openedAt || new Date().toISOString(),
        employees: input.employees ?? 0,
        monthlyRevenue: input.monthlyRevenue ?? 0,
        target: input.target ?? 250_000,
        rating: input.rating ?? 0,
        trend: seedTrend(input.name || uid()),
      };
      setState({ branches: [b, ...state.branches] });
      return b;
    },
    updateBranch(id: string, patch: Partial<Branch>) {
      setState({ branches: state.branches.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
    },
    removeBranches(ids: string[]) {
      const s = new Set(ids);
      setState({ branches: state.branches.filter((b) => !s.has(b.id)) });
    },
    /* leads */
    createLead(input: Partial<Lead>) {
      const l: Lead = {
        id: `LD-${uid().toUpperCase().slice(0, 5)}`,
        name: input.name?.trim() || "New Lead",
        company: input.company || "—",
        city: input.city || "Mumbai",
        owner: input.owner || "you",
        stage: input.stage || "new",
        value: input.value ?? 0,
        source: input.source || "Website",
        createdAt: new Date().toISOString(),
        notes: input.notes || "",
      };
      setState({ leads: [l, ...state.leads] });
      return l;
    },
    updateLead(id: string, patch: Partial<Lead>) {
      setState({ leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
    },
    removeLead(id: string) {
      setState({ leads: state.leads.filter((l) => l.id !== id) });
    },
    /* employees */
    createEmployee(input: Partial<Employee>) {
      const e: Employee = {
        id: `EM-${uid().toUpperCase().slice(0, 5)}`,
        name: input.name?.trim() || "New Employee",
        role: input.role || "Sales Executive",
        branch: input.branch || state.branches[0]?.name || "—",
        status: input.status || "probation",
        joinedAt: input.joinedAt || new Date().toISOString(),
        performance: input.performance ?? 60,
        email: input.email || "",
        availability: input.availability || [true, true, true, true, true, false, false],
      };
      setState({ employees: [e, ...state.employees] });
      return e;
    },
    updateEmployee(id: string, patch: Partial<Employee>) {
      setState({ employees: state.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
    },
    removeEmployees(ids: string[]) {
      const s = new Set(ids);
      setState({ employees: state.employees.filter((e) => !s.has(e.id)) });
    },
    importEmployees(rows: Partial<Employee>[]) {
      const incoming = rows.map((p, i) => ({
        id: `EM-${uid().toUpperCase().slice(0, 5)}${i}`,
        name: String(p.name ?? "Imported"),
        role: String(p.role ?? "Sales Executive"),
        branch: String(p.branch ?? state.branches[0]?.name ?? "—"),
        status: (p.status as EmployeeStatus) ?? "probation",
        joinedAt: String(p.joinedAt ?? new Date().toISOString()),
        performance: Number(p.performance ?? 60),
        email: String(p.email ?? ""),
        availability: Array.isArray(p.availability) ? p.availability : [true, true, true, true, true, false, false],
      }));
      setState({ employees: [...incoming, ...state.employees] });
      return incoming.length;
    },
    /* payments */
    updatePayment(id: string, patch: Partial<Payment>) {
      setState({ payments: state.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    },
  };
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];