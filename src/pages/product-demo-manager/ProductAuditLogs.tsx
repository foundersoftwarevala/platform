import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Lock, Plus, User, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ProductAuditLogs = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["product-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .in("module", ["product", "demo", "products", "demos"])
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-400" />
            Audit Logs
          </h1>
          <p className="text-slate-400 text-sm">Immutable record of all add actions</p>
        </div>
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          <Lock className="w-3 h-3 mr-1" />
          Immutable Records
        </Badge>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  <TableHead className="text-slate-400">Action</TableHead>
                  <TableHead className="text-slate-400">Module</TableHead>
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Timestamp</TableHead>
                  <TableHead className="text-slate-400">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                      Loading audit logs...
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                      No audit logs found
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
                            {log.user_id?.slice(0, 8) || "System"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-400 text-sm">
                            {format(new Date(log.timestamp), "MMM d, yyyy HH:mm")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm max-w-[200px] truncate">
                        {log.meta_json ? JSON.stringify(log.meta_json).slice(0, 50) + "..." : "-"}
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
