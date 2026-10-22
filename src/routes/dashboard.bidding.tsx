import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { BiddingWorkspace } from "@/components/bidding/BiddingWorkspace";

export const Route = createFileRoute("/dashboard/bidding")({
  component: () => (
    <RequireRole role="developer">
      <BiddingWorkspace />
    </RequireRole>
  ),
});
