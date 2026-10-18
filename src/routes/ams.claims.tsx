import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";
import { decideClaim } from "@/lib/ams/engine-views.functions";
import { useServerFn } from "@/lib/serverFn";

export const Route = createFileRoute("/ams/claims")({
  head: () => ({
    meta: [
      { title: "Claims — AMS" },
      { name: "description", content: "Pending, approved, rejected reward claims — verify, dispatch and audit." },
      { property: "og:title", content: "Claims — AMS" },
      { property: "og:description", content: "Pending, approved, rejected reward claims — verify, dispatch and audit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  // Decisions are the database's: ams_decide_claim checks the decider is an
  // administrator and not the claimant, takes the cost from the wallet and the
  // stock on approval, and needs a reason for a refusal.
  const decide = useServerFn(decideClaim);
  const client = useQueryClient();
  const run = (id: string, decision: "approved" | "rejected" | "fulfilled", note?: string) =>
    decide({ data: { id, decision, note } }).then(
      () => {
        toast.success(`Claim ${decision}`);
        void client.invalidateQueries({ queryKey: ["ams-view"] });
      },
      (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
    );
  const state = (row: Record<string, unknown>) => String(row.state ?? "");

  return (
    <AmsEngineView
      view="claims"
      title="Claims"
      description="Pending, approved, rejected reward claims — verify, dispatch and audit."
      columns={[
        {
          key: "claim",
          label: "Claim ID"
        },
        {
          key: "user",
          label: "User"
        },
        {
          key: "reward",
          label: "Reward"
        },
        {
          key: "value",
          label: "Value",
          align: "right"
        },
        {
          key: "requested",
          label: "Requested"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Status",
          key: "status",
          values: []
        }
      ]}
      rowActions={[
        {
          label: "Approve",
          when: (r) => state(r) === "pending",
          onSelect: (r) => {
            if (window.confirm(`Approve ${String(r.claim)}? The cost is taken from the person's wallet.`)) void run(r.id, "approved");
          },
        },
        {
          label: "Reject",
          danger: true,
          when: (r) => state(r) === "pending",
          onSelect: (r) => {
            const reason = window.prompt("Why is this claim refused?")?.trim();
            if (reason) void run(r.id, "rejected", reason);
          },
        },
        {
          label: "Mark fulfilled",
          when: (r) => state(r) === "approved",
          onSelect: (r) => void run(r.id, "fulfilled"),
        },
      ]}
    />
  );
}
