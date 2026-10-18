import { useQuery } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import { getAmsView, type AmsView } from "@/lib/ams/engine-views.functions";

import {
  EngineDashboard,
  StatusChip,
  type DashboardColumn,
  type FilterChip,
  type RowAction,
} from "./EngineDashboard";

/**
 * An AMS engine screen, filled from the AMS tables by getAmsView().
 *
 * The screens used to pass typed-in figures and rows straight to
 * EngineDashboard. They now name their view and their columns; the rows and
 * figures are the platform's. A row's status is shown in `statusKey`.
 */
export function AmsEngineView({
  view,
  title,
  description,
  columns,
  filters = [],
  statusKey = "status",
  rowActions,
}: {
  view: AmsView;
  title: string;
  description: string;
  columns: DashboardColumn[];
  filters?: FilterChip[];
  statusKey?: string;
  rowActions?: RowAction[];
}) {
  const get = useServerFn(getAmsView);
  const query = useQuery({
    queryKey: ["ams-view", view],
    queryFn: () => get({ data: { view } }),
  });
  const rows = (query.data?.rows ?? []).map((r) => ({
    id: r.id,
    ...r.cells,
    ...(r.status ? { [statusKey]: <StatusChip tone={r.status.tone}>{r.status.label}</StatusChip> } : {}),
  }));
  return (
    <EngineDashboard
      kicker="AMS Manager"
      title={title}
      description={description}
      kpis={query.data?.kpis ?? []}
      columns={columns}
      filters={filters}
      rows={rows}
      emptyLabel={query.data?.empty}
      loading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
      onRetry={() => void query.refetch()}
      rowActions={rowActions}
    />
  );
}
