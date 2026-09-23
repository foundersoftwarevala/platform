/**
 * Local persistence for role applications + boss-panel notifications.
 * Stored in localStorage so the flow works without a backend.
 */

export type AppStatus = "pending" | "approved" | "rejected";

export type Application = {
  id: string;
  role: string;
  roleLabel: string;
  applicant: string;
  email: string;
  phone: string;
  fee: string;
  paid: boolean;
  status: AppStatus;
  submittedAt: string;
  reviewedAt?: string;
  note?: string;
  values: Record<string, string>;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: "application" | "approval" | "rejection";
  createdAt: string;
  read: boolean;
};

const APPS_KEY = "sv_applications";
const NOTIF_KEY = "sv_app_notifications";
const EVENT = "sv-applications-changed";

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const listApplications = () =>
  read<Application>(APPS_KEY).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

export const listNotifications = () =>
  read<AppNotification>(NOTIF_KEY).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export function subscribe(cb: () => void) {
  if (!isBrowser()) return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function pushNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">) {
  const rows = read<AppNotification>(NOTIF_KEY);
  rows.push({ ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false });
  write(NOTIF_KEY, rows.slice(-60));
}

export function submitApplication(input: Omit<Application, "id" | "status" | "submittedAt">) {
  const rows = read<Application>(APPS_KEY);
  const app: Application = {
    ...input,
    id: crypto.randomUUID(),
    status: "pending",
    submittedAt: new Date().toISOString(),
  };
  rows.push(app);
  write(APPS_KEY, rows);
  pushNotification({
    kind: "application",
    title: `New ${app.roleLabel.replace("Become ", "")} application`,
    body: `${app.applicant} submitted an application — awaiting approval.`,
  });
  return app;
}

export function setStatus(id: string, status: AppStatus, note?: string) {
  const rows = read<Application>(APPS_KEY);
  const app = rows.find((r) => r.id === id);
  if (!app) return;
  app.status = status;
  app.reviewedAt = new Date().toISOString();
  if (note !== undefined) app.note = note;
  write(APPS_KEY, rows);
  pushNotification({
    kind: status === "approved" ? "approval" : "rejection",
    title: `${app.roleLabel.replace("Become ", "")} application ${status}`,
    body: `${app.applicant} — ${status === "approved" ? "dashboard access granted." : "application rejected."}`,
  });
}

export function markAllRead() {
  const rows = read<AppNotification>(NOTIF_KEY).map((n) => ({ ...n, read: true }));
  write(NOTIF_KEY, rows);
}

export function useApplicationsStore() {
  return { listApplications, listNotifications, subscribe };
}
