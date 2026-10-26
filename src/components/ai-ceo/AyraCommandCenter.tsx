import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Lock, ShieldCheck, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ACCESS_PIN = "1234";

const roles = ["Super Admin", "Franchise", "AYRA Agent", "Normal User"] as const;
type Role = (typeof roles)[number];

const permissions = [
  "Allow System Coding (VS Code)",
  "Allow Web Portal Access",
  "Allow Hardware Control (Brightness/Modules)",
  "Allow Franchise Data Access",
  "Use Server Tools",
] as const;
type Permission = (typeof permissions)[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

const initialGrants: Record<Role, Record<Permission, boolean>> = {
  "Super Admin": Object.fromEntries(permissions.map((permission) => [permission, true])) as Record<
    Permission,
    boolean
  >,
  Franchise: Object.fromEntries(permissions.map((permission) => [permission, false])) as Record<
    Permission,
    boolean
  >,
  "AYRA Agent": Object.fromEntries(permissions.map((permission) => [permission, false])) as Record<
    Permission,
    boolean
  >,
  "Normal User": Object.fromEntries(permissions.map((permission) => [permission, false])) as Record<
    Permission,
    boolean
  >,
};

export function AyraCommandCenter({ open, onClose }: Props) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState("");
  const [role, setRole] = useState<Role>("Franchise");
  const [grants, setGrants] = useState(initialGrants);
  const [fullAccess, setFullAccess] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pin !== ACCESS_PIN) {
      setPinError("Incorrect demo PIN.");
      return;
    }
    setUnlocked(true);
    setPin("");
    setPinError("");
  };

  const updateGrant = (selectedRole: Role, permission: Permission, enabled: boolean) => {
    setGrants((current) => ({
      ...current,
      [selectedRole]: { ...current[selectedRole], [permission]: enabled },
    }));
  };

  const rowClass =
    "flex items-center justify-between gap-3 rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] px-3 py-2.5 text-sm";
  const sectionClass = "mb-2 font-display text-[10px] tracking-widest text-[color:var(--aw-cyan)]";

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
          <h2
            id="ayra-command-title"
            className="aw-display text-lg tracking-widest text-[color:var(--aw-cyan)]"
          >
            AYRA COMMAND CENTER
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full border border-[color:var(--aw-line)] p-2 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-xs">
          <div className="mb-2 flex items-center gap-2 text-[color:var(--aw-cyan)]">
            {unlocked ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {unlocked ? "UNLOCKED — LOCAL PREVIEW" : "LOCKED — ENTER DEMO PIN"}
          </div>
          {!unlocked ? (
            <form className="flex gap-2" onSubmit={unlock}>
              <input
                aria-label="Command Center PIN"
                className="min-w-0 flex-1 rounded-md border border-[color:var(--aw-line)] bg-black/20 px-3 py-2 text-sm outline-none focus:border-[color:var(--aw-cyan)]"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
              <button
                className="rounded-md bg-[color:var(--aw-cyan)] px-3 py-2 font-semibold text-slate-950 disabled:opacity-50"
                disabled={!pin}
                type="submit"
              >
                Unlock
              </button>
            </form>
          ) : (
            <p className="text-[color:var(--aw-soft)]">Demo PIN accepted for this page session.</p>
          )}
          {pinError && (
            <p className="mt-2 text-[color:var(--aw-red)]" role="alert">
              {pinError}
            </p>
          )}
        </div>

        <div className="mb-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          UI preview only: the demo PIN is not authentication. These controls are held in page
          memory and do not change VPS permissions or grant access to tools.
        </div>

        {unlocked && (
          <div className="grid gap-5">
            <section>
              <div className={sectionClass}>ROLES &amp; PERMISSIONS</div>
              <div className={rowClass}>
                <span className="font-semibold">Full Access Mode (Master)</span>
                <Switch
                  aria-label="Full access mode"
                  checked={fullAccess}
                  onCheckedChange={setFullAccess}
                  className="data-[state=checked]:bg-[color:var(--aw-cyan)] data-[state=checked]:shadow-[0_0_12px_var(--aw-cyan)]"
                />
              </div>
            </section>

            <section>
              <div className={sectionClass}>FRANCHISE &amp; AYRA AGENT GRANTS</div>
              <div className="grid gap-2">
                {(["Franchise", "AYRA Agent"] as const).map((grantRole) => (
                  <div
                    key={grantRole}
                    className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3"
                  >
                    <h3 className="mb-2 text-xs font-semibold text-[color:var(--aw-cyan)]">
                      {grantRole}
                    </h3>
                    {permissions.map((permission) => (
                      <div
                        key={permission}
                        className="flex items-center justify-between gap-3 py-2 text-xs"
                      >
                        <span>{permission}</span>
                        <Switch
                          aria-label={`${grantRole}: ${permission}`}
                          checked={grants[grantRole][permission]}
                          onCheckedChange={(enabled) => updateGrant(grantRole, permission, enabled)}
                          className="data-[state=checked]:bg-[color:var(--aw-cyan)] data-[state=checked]:shadow-[0_0_12px_var(--aw-cyan)]"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className={sectionClass}>ROLE MANAGEMENT</div>
              <label className="sr-only" htmlFor="ayra-command-role">
                Select role
              </label>
              <select
                id="ayra-command-role"
                aria-label="Select role"
                className="w-full rounded-md border border-[color:var(--aw-line)] bg-slate-950 px-3 py-2 text-sm"
                value={role}
                onChange={(event) => {
                  const nextRole = roles.find((item) => item === event.target.value);
                  if (nextRole) setRole(nextRole);
                }}
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid gap-2">
                {permissions.map((permission) => (
                  <div key={permission} className={rowClass}>
                    <span>{permission}</span>
                    <Switch
                      aria-label={`${role}: ${permission}`}
                      checked={grants[role][permission]}
                      onCheckedChange={(enabled) => updateGrant(role, permission, enabled)}
                      className="data-[state=checked]:bg-[color:var(--aw-cyan)] data-[state=checked]:shadow-[0_0_12px_var(--aw-cyan)]"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {!unlocked && (
          <p className="flex items-center gap-2 text-xs text-[color:var(--aw-muted)]">
            <KeyRound className="h-3.5 w-3.5" />
            Demo PIN: 1234
          </p>
        )}
      </aside>
    </div>
  );
}
