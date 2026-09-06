import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmButton } from "./ConfirmButton";
import { CatalogueSection, type CatalogueColumn } from "./CatalogueSection";
import { useLegalRecords, useUpdateRecordStatus, type LegalRecord } from "@/lib/legal-data";

export interface CatalogueAction {
  label: string;
  status: string;
  /** Audit-trail action name. */
  action: string;
  icon?: React.ComponentType<{ className?: string }>;
  confirm?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
}

export interface CatalogueTile {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value?: string;
  hint?: string;
}

interface CatalogueScreenProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  tableTitle: string;
  columns: CatalogueColumn[];
  focusLabel?: string | null;
  actions?: CatalogueAction[];
  tiles?: CatalogueTile[];
  emptyTitle?: string;
  emptyDescription?: string;
  children?: ReactNode;
}

export const statusBadge = (status: string) => {
  const value = String(status ?? "").toLowerCase();
  const tone =
    ["active", "bound", "approved", "compliant", "protected", "published", "resolved", "enabled", "registered"].includes(value)
      ? "bg-emerald-500/15 text-emerald-400"
      : ["pending", "review", "review_needed", "draft", "monitoring"].includes(value)
        ? "bg-yellow-500/15 text-yellow-400"
        : ["rejected", "expired", "violation", "concern", "blocked", "critical"].includes(value)
          ? "bg-red-500/15 text-red-400"
          : "bg-muted/30 text-muted-foreground";
  return <Badge className={tone}>{value.replace(/_/g, " ") || "unknown"}</Badge>;
};

/** Shared screen scaffold: hero row, KPI tiles and a fully interactive record table. */
export const CatalogueScreen = ({
  title,
  description,
  icon: Icon,
  category,
  tableTitle,
  columns,
  focusLabel,
  actions = [],
  tiles = [],
  emptyTitle,
  emptyDescription,
  children,
}: CatalogueScreenProps) => {
  const { data: records = [], isLoading, isError, error, refetch } = useLegalRecords(category);
  const updateRecord = useUpdateRecordStatus();

  const runAction = (record: LegalRecord, config: CatalogueAction) => {
    updateRecord.mutate(
      {
        id: record.id,
        category,
        status: config.status,
        action: config.action,
        details: `${record.ref_code ?? record.name} → ${config.status}`,
      },
      {
        onSuccess: () => toast.success(`${config.label}: ${record.name}`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );
  };

  const renderActions = (record: LegalRecord, compact: boolean) =>
    actions
      .filter((config) => String(record.status).toLowerCase() !== config.status)
      .map((config) => {
        const ActionIcon = config.icon;
        const content = (
          <>
            {ActionIcon && <ActionIcon className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />}
            {!compact && config.label}
          </>
        );
        return config.confirm ? (
          <ConfirmButton
            key={config.label}
            size="sm"
            variant={config.variant ?? "ghost"}
            title={`${config.label}?`}
            description={`This updates ${record.name} to "${config.status}" and writes an entry to the immutable audit trail.`}
            confirmLabel={config.label}
            onConfirm={() => runAction(record, config)}
            aria-label={`${config.label} ${record.name}`}
            disabled={updateRecord.isPending}
          >
            {content}
          </ConfirmButton>
        ) : (
          <Button
            key={config.label}
            size="sm"
            variant={config.variant ?? "ghost"}
            onClick={() => runAction(record, config)}
            aria-label={`${config.label} ${record.name}`}
            disabled={updateRecord.isPending}
          >
            {content}
          </Button>
        );
      });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
          <Icon className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile, index) => (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full border-border/50 bg-card/50">
                <CardContent className="p-4">
                  <tile.icon className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">{tile.label}</p>
                  {tile.value && (
                    <p className="mt-1 text-2xl font-bold text-foreground">{tile.value}</p>
                  )}
                  {tile.hint && <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {children}

      <CatalogueSection
        title={tableTitle}
        icon={Icon}
        records={records}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        focusLabel={focusLabel ?? null}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        rowActions={(record) => renderActions(record, true)}
        drawerActions={(record) => renderActions(record, false)}
      />
    </div>
  );
};

export default CatalogueScreen;
