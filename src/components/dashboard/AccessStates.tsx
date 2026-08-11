import { ShieldAlert, Loader2 } from "lucide-react";
import type { RoleKey } from "@/lib/roles";
import { ROLES } from "@/lib/roles";

/** Suspense fallback for lazily loaded module workspaces. */
export function ModuleFallback() {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Loading workspace…
    </div>
  );
}

/** Shown when the signed-in user is not permitted to view this role dashboard. */
export function AccessDenied({
  roleName, sessionRole, onGoHome,
}: { roleName: string; sessionRole: RoleKey | null; onGoHome: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-card p-8 text-center space-y-3 depth-3d">
      <ShieldAlert className="h-8 w-8 mx-auto text-danger" aria-hidden />
      <h2 className="text-lg font-semibold">Access restricted</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Your account does not have permission to open the {roleName} dashboard.
        {sessionRole ? ` You are signed in as ${ROLES[sessionRole].name}.` : ""}
      </p>
      {sessionRole && (
        <button
          onClick={onGoHome}
          className="press-3d inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
        >
          Go to my {ROLES[sessionRole].name} dashboard
        </button>
      )}
    </div>
  );
}
