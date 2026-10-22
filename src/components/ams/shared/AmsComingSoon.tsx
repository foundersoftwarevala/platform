import { Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";

export function AmsComingSoon() {
  return (
    <section className="surface-card mx-auto my-12 max-w-2xl space-y-4 p-8 text-center" role="status">
      <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Coming Soon</p>
        <h1 className="mt-2 text-2xl font-semibold">Live collection records are not connected</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        This page currently contains static role-asset previews, not verified
        user-issued or user-earned records. It is disabled until those records
        are backed by the AMS database.
      </p>
      <Link to="/ams/achievements" className="inline-flex text-sm font-medium text-primary hover:underline">
        View recorded achievements
      </Link>
    </section>
  );
}
