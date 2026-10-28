import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { loadAyraGrantAudit, loadAyraGrants, setAyraGrant } from "@/lib/ai-ceo/ceo.functions";
import { AYRA_PERMISSION_GROUPS, AYRA_ROLES, type AyraGrantPermission, type AyraGrantRole } from "@/lib/ai-ceo/ayra-grants";

const ROLE_LABELS: Record<AyraGrantRole, string> = {
  SUPER_ADMIN: "Super Admin",
  FRANCHISE: "Franchise",
  AYRA_AGENT: "AYRA Agent",
};
const TABS = [...Object.keys(AYRA_PERMISSION_GROUPS), "Audit Logs"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AyraCommandCenter({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fetchGrants = useServerFn(loadAyraGrants);
  const fetchAudit = useServerFn(loadAyraGrantAudit);
  const saveGrant = useServerFn(setAyraGrant);
  const [selectedRole, setSelectedRole] = useState<AyraGrantRole>("SUPER_ADMIN");
  const [selectedTab, setSelectedTab] = useState<Tab>("System Control");

  const grants = useQuery({
    queryKey: ["ayra", "grants"],
    queryFn: () => fetchGrants(),
    enabled: open,
    staleTime: 0,
  });
  const audit = useQuery({
    queryKey: ["ayra", "grant-audit"],
    queryFn: () => fetchAudit(),
    enabled: open && selectedTab === "Audit Logs",
    staleTime: 0,
  });
  const update = useMutation({
    mutationFn: (input: { roleName: AyraGrantRole; permissionKey: AyraGrantPermission; isEnabled: boolean }) =>
      saveGrant({ data: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ayra", "grants"] }),
        queryClient.invalidateQueries({ queryKey: ["ayra", "grant-audit"] }),
      ]);
      toast.success("Permission saved to VPS Postgres.");
    },
    onError: (error: unknown) => {
      toast.error("Permission was not saved", {
        description: error instanceof Error ? error.message : "The server refused the update.",
      });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const permissionRows = selectedTab in AYRA_PERMISSION_GROUPS
    ? AYRA_PERMISSION_GROUPS[selectedTab as keyof typeof AYRA_PERMISSION_GROUPS]
    : [];
  const errorMessage = grants.error instanceof Error ? grants.error.message : "Could not load AYRA grants.";

  return (
    <div
      className="aw-command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside
        className="aw-command-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayra-command-title"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="ayra-command-title" className="aw-display text-lg tracking-widest text-[color:var(--aw-cyan)]">
            AYRA COMMAND CENTER
          </h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-full border border-[color:var(--aw-line)] p-2 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-sm text-[color:var(--aw-soft)]">
          Only Control Panel-authorized Boss, Admin, or Super Admin users can manage these VPS-backed grants. There is no shared default PIN.
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold tracking-widest text-[color:var(--aw-cyan)]">ROLES &amp; PERMISSIONS</div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Grant role">
            {AYRA_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                role="tab"
                aria-selected={selectedRole === role}
                onClick={() => setSelectedRole(role)}
                className={`rounded-md border px-3 py-2 text-sm ${selectedRole === role ? "aw-tab-on border-[color:var(--aw-cyan)]" : "border-[color:var(--aw-line)]"}`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 border-b border-[color:var(--aw-line)] pb-2" role="tablist" aria-label="Permission settings">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selectedTab === tab}
              onClick={() => setSelectedTab(tab)}
              className={`rounded-md px-2 py-2 text-xs ${selectedTab === tab ? "aw-tab-on" : "text-[color:var(--aw-soft)]"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {grants.isLoading ? (
          <p role="status" className="text-sm text-[color:var(--aw-soft)]">Loading grants from VPS Postgres…</p>
        ) : grants.isError ? (
          <div role="alert" className="space-y-3 text-sm text-destructive">
            <p>{errorMessage}</p>
            <button type="button" onClick={() => void grants.refetch()} className="rounded border border-current px-3 py-2">Try again</button>
          </div>
        ) : selectedTab === "Audit Logs" ? (
          audit.isLoading ? (
            <p role="status" className="text-sm text-[color:var(--aw-soft)]">Loading grant audit history…</p>
          ) : audit.isError ? (
            <div role="alert" className="space-y-3 text-sm text-destructive">
              <p>{audit.error instanceof Error ? audit.error.message : "Could not load the grant audit history."}</p>
              <button type="button" onClick={() => void audit.refetch()} className="rounded border border-current px-3 py-2">Try again</button>
            </div>
          ) : audit.data?.length ? (
            <div className="space-y-2" aria-label="AYRA grant audit history">
              {audit.data.map((entry) => (
                <div key={entry.id} className="rounded-md border border-[color:var(--aw-line)] p-3 text-sm">
                  <div className="font-medium">{entry.action.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-xs text-[color:var(--aw-soft)]">{entry.actor} · {entry.entityId ?? "grant"} · {entry.occurredAt}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[color:var(--aw-soft)]">No AYRA grant changes have been recorded.</p>
          )
        ) : permissionRows.length === 0 ? (
          <p className="text-sm text-[color:var(--aw-soft)]">No permissions are configured for this section.</p>
        ) : (
          <div className="space-y-2" aria-label={`${ROLE_LABELS[selectedRole]} grants`}>
            {permissionRows.map(([permissionKey, label]) => {
              const grant = grants.data?.find((row) => row.roleName === selectedRole && row.permissionKey === permissionKey);
              return (
                <div key={permissionKey} className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--aw-line)] bg-white/[0.03] p-3">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-1 font-mono text-[10px] text-[color:var(--aw-muted)]">{permissionKey}</div>
                  </div>
                  {grant ? (
                    <Switch
                      aria-label={label}
                      checked={grant.isEnabled}
                      disabled={update.isPending}
                      onCheckedChange={(isEnabled) => update.mutate({ roleName: selectedRole, permissionKey, isEnabled })}
                    />
                  ) : (
                    <span className="text-xs text-[color:var(--aw-muted)]">Not configured</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
