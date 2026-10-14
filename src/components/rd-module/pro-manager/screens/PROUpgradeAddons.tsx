import { Button } from "@/components/rd-module/ui/button";
import { usePMUpgrades } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMBadge, PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDate } from "../pm-ui";

export const PROUpgradeAddons = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMUpgrades();
  const { updateUpgrade, run } = useProManagerActions();

  const term = search.trim().toLowerCase();
  const upgrades = (data ?? []).filter((row) =>
    term
      ? [row.code, row.user_code, row.type, row.item, row.status]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );

  return (
    <PMSection
      title="Upgrade & add-ons"
      description="Upgrade and add-on requests. Billing is never executed here — the Pro Manager recommends or rejects."
    >
      <PMPanel>
        {isLoading ? (
          <PMLoading rows={4} />
        ) : upgrades.length === 0 ? (
          <PMEmpty message="No upgrade requests match this search." />
        ) : (
          <div className="space-y-3">
            {upgrades.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {row.code} • {row.item}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.user_code} • requested {formatDate(row.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PMBadge tone="muted">{row.type}</PMBadge>
                  <StatusBadge value={row.status} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void run(
                        "Upgrade recommended",
                        updateUpgrade({
                          data: { id: row.id, code: row.code, status: "recommended" },
                        }),
                      )
                    }
                  >
                    Recommend
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      void run(
                        "Upgrade approved",
                        updateUpgrade({ data: { id: row.id, code: row.code, status: "approved" } }),
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      void run(
                        "Upgrade rejected",
                        updateUpgrade({ data: { id: row.id, code: row.code, status: "rejected" } }),
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PMPanel>
    </PMSection>
  );
};
