import { Button } from "@/components/rd-module/ui/button";
import { usePMRenewals } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDay } from "../pm-ui";

export const PRORenewalExpiry = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMRenewals();
  const { updateRenewal, run } = useProManagerActions();

  const term = search.trim().toLowerCase();
  const renewals = (data ?? []).filter((row) =>
    term
      ? [row.code, row.user_code, row.product, row.status].join(" ").toLowerCase().includes(term)
      : true,
  );

  return (
    <PMSection
      title="Renewal & expiry"
      description="Renewal queue with reminders, grace extensions and automatic suspension. No payment is ever taken here."
    >
      <PMPanel>
        {isLoading ? (
          <PMLoading rows={4} />
        ) : renewals.length === 0 ? (
          <PMEmpty message="No renewals match this search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Renewal</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Expiry</th>
                  <th className="py-2 pr-4">Grace</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {renewals.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{row.code}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.user_code}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.product}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDay(row.expiry)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.grace}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void run(
                              "Renewal reminder sent",
                              updateRenewal({
                                data: { id: row.id, code: row.code, intent: "notify" },
                              }),
                            )
                          }
                        >
                          Notify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void run(
                              "Grace period extended",
                              updateRenewal({
                                data: { id: row.id, code: row.code, intent: "extend_grace" },
                              }),
                            )
                          }
                        >
                          Extend grace
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            void run(
                              "Auto suspend applied",
                              updateRenewal({
                                data: { id: row.id, code: row.code, intent: "suspend" },
                              }),
                            )
                          }
                        >
                          Suspend
                        </Button>
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
