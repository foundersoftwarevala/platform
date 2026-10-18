import { Users2 } from "lucide-react";
import { usePMManagerMetrics } from "@/hooks/rd-module/useProManagerData";
import { PMEmpty, PMLoading, PMPanel, StatusBadge } from "./pm-ui";

export const PMManagerSnapshot = () => {
  const { data, isLoading } = usePMManagerMetrics();
  const managers = data ?? [];

  return (
    <PMPanel
      title="Manager snapshot"
      description="Cross-manager SLA and escalation performance"
      icon={Users2}
    >
      {isLoading ? (
        <PMLoading />
      ) : managers.length === 0 ? (
        <PMEmpty message="No manager metrics recorded." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Manager</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">SLA</th>
                <th className="py-2 pr-4">Handled</th>
                <th className="py-2 pr-4">Pending</th>
                <th className="py-2 pr-4">Avg resolution</th>
                <th className="py-2 pr-4">Trend</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {manager.manager_code}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{manager.role}</td>
                  <td className="py-2.5 pr-4 text-foreground">{manager.sla_compliance}%</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {manager.escalations_handled}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {manager.escalations_pending}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {manager.avg_resolution_time}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{manager.trend}</td>
                  <td className="py-2.5">
                    <StatusBadge value={manager.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PMPanel>
  );
};
