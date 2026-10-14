import { usePMUsers } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { Button } from "@/components/rd-module/ui/button";
import { PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDate } from "../pm-ui";

const STATUSES = ["active", "suspended", "expired", "high_risk"] as const;

export const PROUserRegistry = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMUsers();
  const { setProUserStatus, run } = useProManagerActions();

  const term = search.trim().toLowerCase();
  const users = (data ?? []).filter((user) =>
    term
      ? [user.code, user.product, user.license, user.region, user.tier, user.status]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );

  return (
    <PMSection
      title="Pro user registry"
      description="Premium accounts under Pro Manager governance. Accounts can be suspended or reinstated, never deleted."
    >
      <PMPanel>
        {isLoading ? (
          <PMLoading rows={5} />
        ) : users.length === 0 ? (
          <PMEmpty message="No accounts match this search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">License</th>
                  <th className="py-2 pr-4">Region</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Since</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Governance action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{user.code}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{user.product}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{user.license}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{user.region}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{user.tier}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge value={user.status} />
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.filter((status) => status !== user.status).map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={status === "suspended" ? "destructive" : "outline"}
                            onClick={() =>
                              void run(
                                `Account ${status.replace("_", " ")}`,
                                setProUserStatus({
                                  data: { id: user.id, code: user.code, status },
                                }),
                              )
                            }
                          >
                            {status.replace("_", " ")}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PMPanel>
    </PMSection>
  );
};
