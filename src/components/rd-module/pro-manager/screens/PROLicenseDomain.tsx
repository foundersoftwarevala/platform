import { Button } from "@/components/rd-module/ui/button";
import { usePMLicenses } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDay } from "../pm-ui";

export const PROLicenseDomain = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMLicenses();
  const { updateLicense, run } = useProManagerActions();
  const term = search.trim().toLowerCase();
  const licenses = (data ?? []).filter((row) =>
    term
      ? [row.user_code, row.license_type, row.domain, row.domain_status]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );

  return (
    <PMSection
      title="License & domain"
      description="License bindings, verified domains and transfer requests. Transfers are recommended, never executed here."
    >
      <PMPanel>
        {isLoading ? (
          <PMLoading rows={4} />
        ) : licenses.length === 0 ? (
          <PMEmpty message="No license records match this search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">License type</th>
                  <th className="py-2 pr-4">Domain</th>
                  <th className="py-2 pr-4">Domain status</th>
                  <th className="py-2 pr-4">Expiry</th>
                  <th className="py-2 pr-4">Transfer</th>
                  <th className="py-2">Governance actions</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{row.user_code}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.license_type}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.domain}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge value={row.domain_status} />
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDay(row.expiry)}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge value={row.transfer_status} />
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            void run(
                              "Renewal initiated",
                              updateLicense({
                                data: { id: row.id, user_code: row.user_code, intent: "renew" },
                              }),
                            )
                          }
                        >
                          Renew
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void run(
                              "Upgrade recommended",
                              updateLicense({
                                data: { id: row.id, user_code: row.user_code, intent: "upgrade" },
                              }),
                            )
                          }
                        >
                          Recommend upgrade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void run(
                              row.domain_status === "locked" ? "Domain unlocked" : "Domain locked",
                              updateLicense({
                                data: {
                                  id: row.id,
                                  user_code: row.user_code,
                                  intent:
                                    row.domain_status === "locked"
                                      ? "unlock_domain"
                                      : "lock_domain",
                                },
                              }),
                            )
                          }
                        >
                          {row.domain_status === "locked" ? "Unlock domain" : "Lock domain"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={row.transfer_status === "requested"}
                          onClick={() =>
                            void run(
                              "Transfer request forwarded",
                              updateLicense({
                                data: {
                                  id: row.id,
                                  user_code: row.user_code,
                                  intent: "request_transfer",
                                },
                              }),
                            )
                          }
                        >
                          Request rebind
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
