import { ShieldAlert, Lock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePermissions, can, type Permission } from "@/lib/affiliate-permissions";
import { EmptyState } from "@/components/affiliate/EmptyState";

/**
 * Gates a route or section behind a required permission. Renders a 403-style
 * empty state when the caller lacks the permission, a sign-in prompt when
 * anonymous, and a loading placeholder while the matrix is fetched.
 */
export function PermissionGate({
  permission,
  children,
  fallbackTitle = "Access restricted",
}: {
  permission: Permission;
  children: ReactNode;
  fallbackTitle?: string;
}) {
  const { data, isLoading } = usePermissions();
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="m-4 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground lg:m-6">
        Verifying permissions…
      </div>
    );
  }
  if (!data?.authenticated) {
    return (
      <div className="bento-card m-4 !p-0 lg:m-6">
        <EmptyState
          icon={Lock}
          title="Sign in required"
          description="Sign in with a boss-panel operator account to view this workspace."
          primaryAction={{ label: "Sign in", onClick: () => navigate({ to: "/auth" }) }}
        />
      </div>
    );
  }


  if (!can(data, permission)) {
    return (
      <div className="m-4 rounded-2xl border border-destructive/30 bg-destructive/5 lg:m-6">
        <EmptyState
          icon={ShieldAlert}
          title={`403 — ${fallbackTitle}`}
          description={`Your role (${data.roles.join(", ") || "none"}) does not include the "${permission}" permission. Ask an admin to grant access.`}
        />
      </div>
    );
  }
  return <>{children}</>;
}

export function InlineDenied({ permission }: { permission: Permission }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
      <Lock className="size-3" /> Missing {permission}
    </div>
  );
}
