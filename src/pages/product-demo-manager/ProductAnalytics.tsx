import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Lock, TrendingUp, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ProductAnalytics = () => {
  const { data: audit = [], isLoading } = useQuery({
    queryKey: ["demo-analytics-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_url_audit_log")
        .select("action, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const checks = audit.filter((entry) => entry.action === "demo_url.test").length;
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-pink-400" />
            Analytics
          </h1>
          <p className="text-slate-400 text-sm">Read-only analytics and reports</p>
        </div>
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          <Eye className="w-3 h-3 mr-1" />
          View Only
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{isLoading ? "..." : checks}</p>
                <p className="text-xs text-slate-400">Demo Engagement</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{isLoading ? "..." : audit.length}</p>
                <p className="text-xs text-slate-400">Tracked actions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">-</p>
                <p className="text-xs text-slate-400">Growth unavailable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            Analytics Data (Read Only)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded-lg">
            <p className="text-slate-400">No chart data is available yet.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductAnalytics;
