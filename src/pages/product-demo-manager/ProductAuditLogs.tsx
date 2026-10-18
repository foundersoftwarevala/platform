import { useResource } from "@/lib/manager/use-resource";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Lock, Plus, User, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ProductAuditLogs = () => {
  const { t, formatDate } = useTranslation();
  /**
   * The trail product and demo changes are actually written to.
   *
   * This read audit_logs through the browser Supabase client - the hosted
   * project, not the VPS - while every product or demo created, changed or
   * retired through the Manager is recorded in marketplace_audit_logs on the
   * VPS (resource.ts recordAudit). So the screen could not show a single one of
   * them. It reads that trail now, through the same operator-checked endpoint
   * as the rest of the studio.
   */
  const productTrail = useResource("audit_history", {
    limit: 100,
    filters: ["entity_type.eq.products"],
    sort: "created_at",
    dir: "desc",
  });
  const demoTrail = useResource("audit_history", {
    limit: 100,
    filters: ["entity_type.eq.demos"],
    sort: "created_at",
    dir: "desc",
  });
  const isLoading = productTrail.loading || demoTrail.loading;
  const failed = productTrail.failed || demoTrail.failed;
  const logs = [...productTrail.rows, ...demoTrail.rows]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 100)
    .map((row) => ({
      id: String(row.id),
      action: String(row.action ?? ""),
      module: String(row.entity_type ?? ""),
      // The operator's e-mail when the trail has it; otherwise their id.
      user_id: row.actor ? String(row.actor) : row.actor_id ? String(row.actor_id) : null,
      timestamp: String(row.created_at ?? ""),
      meta_json: row.reason ?? row.after_state ?? row.metadata ?? null,
    }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-400" />
            {t("manager.products.audit_title")}
          </h1>
          <p className="text-slate-400 text-sm">{t("manager.products.audit_subtitle")}</p>
        </div>
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          <Lock className="w-3 h-3 mr-1" />
          {t("manager.products.audit_badge")}
        </Badge>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  <TableHead className="text-slate-400">{t("manager.products.col_action")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_module")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_user")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_timestamp")}</TableHead>
                  <TableHead className="text-slate-400">{t("manager.products.col_details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                      {t("manager.products.audit_loading")}
                    </TableCell>
                  </TableRow>
                ) : failed ? (
                  // A trail that could not be read is not an empty one.
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-red-400 py-8">
                      {t("manager.products.audit_unreadable")}
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                      {t("manager.products.audit_empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log) => (
                    <TableRow key={log.id} className="border-slate-700/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-emerald-400" />
                          <span className="text-white">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300 text-sm">
                            {log.user_id?.includes("@") ? log.user_id : log.user_id?.slice(0, 8) || t("manager.products.actor_system")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-400 text-sm">
                            {log.timestamp ? formatDate(log.timestamp, { dateStyle: "medium", timeStyle: "short" }) : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm max-w-[200px] truncate">
                        {log.meta_json
                          ? typeof log.meta_json === "string"
                            ? log.meta_json
                            : JSON.stringify(log.meta_json).slice(0, 50) + "..."
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductAuditLogs;
