import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Search, ShieldCheck, X } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";

/**
 * Security & Access - the roles and permissions half of it, connected.
 *
 * The screen that was here listed Roles, Permissions and Access Control as
 * features and showed a Roles tab with no roles in it. These are the real
 * roles, with the number of people who actually hold each one, and the matrix
 * shown is the same one the server consults on the next request - so a
 * permission revoked here is refused a moment later, not merely displayed as
 * revoked.
 *
 * Section 11 is followed in the controls as well as in the guard: an operator
 * who cannot configure permissions is not shown a disabled toggle to wonder
 * about, they are shown the matrix read-only with one line saying why.
 *
 * The static original is kept as SecuritySectionStatic. Sessions, 2FA and IP
 * allowlists are still that screen's tabs and are untouched here; this replaces
 * only the part that had real data behind it.
 */

type RoleRow = {
  role: string;
  users: number;
  granted: string[];
  denied: string[];
  origin: "default" | "override";
  shipped: string[];
};

type Data = {
  ok: boolean;
  source: "defaults" | "system_settings";
  overridden: string[];
  permissions: { id: string; module: string }[];
  roles: RoleRow[];
  caller: { roles: string[]; via: string; can_edit: boolean; edit_reason: string | null };
  unsupported: Record<string, string>;
};

const label = (permission: string) => permission.replace(/^marketplace\./, "");

export function RoleMatrix() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [role, setRole] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [access, setAccess] = useState<"all" | "granted" | "denied">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/permissions", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error ?? `The matrix could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
      setRole((current) => current ?? (payload as Data).roles.find((r) => r.granted.length)?.role ?? null);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modules = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.permissions.map((p) => p.module))).sort();
  }, [data]);

  const selected = data?.roles.find((r) => r.role === role) ?? null;

  /** Section 17: one search box over role, permission and module. */
  const visibleRoles = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.roles;
    return data.roles.filter(
      (r) =>
        r.role.toLowerCase().includes(q) ||
        r.granted.some((p) => p.toLowerCase().includes(q)),
    );
  }, [data, query]);

  const visiblePermissions = useMemo(() => {
    if (!data || !selected) return [];
    const q = query.trim().toLowerCase();
    return data.permissions.filter((p) => {
      if (moduleFilter !== "all" && p.module !== moduleFilter) return false;
      const has = selected.granted.includes(p.id);
      if (access === "granted" && !has) return false;
      if (access === "denied" && has) return false;
      if (q && !p.id.toLowerCase().includes(q) && !p.module.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, selected, query, moduleFilter, access]);

  const toggle = useCallback(
    async (permission: string, granted: boolean) => {
      if (!selected) return;
      setBusy(permission);
      setNote(null);
      try {
        const response = await fetch("/api/marketplace/permissions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ role: selected.role, permission, granted }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          // Never a success message the server did not give - section 42.
          setNote(payload?.message ?? payload?.error ?? `That change was refused (${response.status}).`);
          return;
        }
        setNote(
          payload.unchanged
            ? String(payload.message)
            : `${label(permission)} ${granted ? "granted to" : "revoked from"} ${selected.role}. In force from the next request.`,
        );
        await load();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : "That change did not reach the server.");
      } finally {
        setBusy(null);
      }
    },
    [selected, load],
  );

  const reset = useCallback(async () => {
    if (!window.confirm("Return every role to its shipped Marketplace permissions?")) return;
    setBusy("reset");
    try {
      const response = await fetch("/api/marketplace/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ reset: true }),
      });
      const payload = await response.json().catch(() => ({}));
      setNote(
        response.ok && payload.ok
          ? "Every role is back on its shipped permissions."
          : (payload?.message ?? payload?.error ?? "The reset was refused."),
      );
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Security & Access" title="Roles & Permissions" description="Who may do what in the Marketplace." />
        <LoadFailure error={error} onRetry={load} what="the permission matrix" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Security & Access" title="Roles & Permissions" description="Who may do what in the Marketplace." />
        <Card className="overflow-hidden p-0"><div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading the matrix…</div></Card>
      </div>
    );
  }

  const editable = data.caller.can_edit;
  const people = data.roles.reduce((total, r) => total + r.users, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Security & Access"
        title="Roles & Permissions"
        description="Every Marketplace action is checked against this on the server. What you see here is what the guard reads."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Roles" value={String(data.roles.length)} />
        <StatCard label="People with a role" value={String(people)} tone="premium" />
        <StatCard label="Permissions" value={String(data.permissions.length)} />
        <StatCard
          label="Changed from shipped"
          value={String(data.overridden.length)}
          tone={data.overridden.length ? "warning" : "success"}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a role, a permission or a module"
              aria-label="Search roles and permissions"
              className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Filter by module"
            className="rounded-md border bg-background px-2 py-2 text-sm"
          >
            <option value="all">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={access}
            onChange={(e) => setAccess(e.target.value as typeof access)}
            aria-label="Filter by access"
            className="rounded-md border bg-background px-2 py-2 text-sm"
          >
            <option value="all">Granted and denied</option>
            <option value="granted">Granted only</option>
            <option value="denied">Denied only</option>
          </select>
          {editable && data.source === "system_settings" ? (
            <PillButton onClick={reset} disabled={busy === "reset"}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to shipped
            </PillButton>
          ) : null}
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {data.source === "defaults"
            ? "These are the shipped permissions. Nothing has been changed here."
            : `Changed here for: ${data.overridden.join(", ") || "no role"}.`}
          {" "}You are signed in as {data.caller.roles.join(", ") || "no role"}.
          {editable ? null : " Changing permissions is not something this role can do, so the matrix is read-only."}
        </div>
      </Card>

      {note ? (
        <Card className="overflow-hidden p-0"><div className="p-3 text-sm">{note}</div></Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Roles
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {visibleRoles.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No role matches that search.</div>
            ) : visibleRoles.map((r) => (
              <button
                key={r.role}
                onClick={() => setRole(r.role)}
                aria-current={r.role === role}
                className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${r.role === role ? "bg-muted" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className={`h-3.5 w-3.5 ${r.granted.length ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className="font-medium">{r.role}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.origin === "override" ? (
                    <span className="rounded border border-amber-500/30 px-1 text-amber-500">changed</span>
                  ) : null}
                  <span>{r.granted.length}/{data.permissions.length}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          {!selected ? (
            <div className="p-6 text-sm text-muted-foreground">Pick a role to see what it may do.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <div>
                  <div className="text-sm font-semibold">{selected.role}</div>
                  <div className="text-xs text-muted-foreground">
                    {selected.users === 0
                      ? "Nobody currently holds this role."
                      : `${selected.users} ${selected.users === 1 ? "person holds" : "people hold"} this role.`}
                    {" "}
                    {selected.granted.length === 0
                      ? "It has no Marketplace permissions, so the console refuses it entirely."
                      : `${selected.granted.length} of ${data.permissions.length} permissions.`}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selected.origin === "override" ? "Changed from shipped" : "As shipped"}
                </span>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {visiblePermissions.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nothing matches those filters.</div>
                ) : visiblePermissions.map((p) => {
                  const has = selected.granted.includes(p.id);
                  const shipped = selected.shipped.includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 border-b px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{label(p.id)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.id} · {p.module}
                          {has !== shipped ? (shipped ? " · revoked here" : " · granted here") : ""}
                        </div>
                      </div>
                      {/* Section 11: no permission to configure means no control
                          at all, not a disabled one. The state is still read as
                          text, never by colour alone - section 31. */}
                      {editable ? (
                        <button
                          onClick={() => void toggle(p.id, !has)}
                          disabled={busy === p.id}
                          aria-label={`${has ? "Revoke" : "Grant"} ${p.id} for ${selected.role}`}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs ${has ? "border-emerald-500/40 text-emerald-500" : "border-muted text-muted-foreground"}`}
                        >
                          {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" />
                            : has ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {has ? "Granted" : "Denied"}
                        </button>
                      ) : (
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs ${has ? "border-emerald-500/40 text-emerald-500" : "border-muted text-muted-foreground"}`}>
                          {has ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {has ? "Granted" : "Denied"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Asked for, and not here
        </div>
        <div className="space-y-2 p-3 text-sm text-muted-foreground">
          {Object.entries(data.unsupported).map(([key, why]) => (
            <div key={key}>
              <span className="font-medium text-foreground">{key.replace(/_/g, " ")}</span> — {why}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
