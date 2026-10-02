import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Lock, TrendingUp, Eye } from "lucide-react";
import { useResource } from "@/lib/manager/use-resource";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Demo activity, counted on the VPS.
 *
 * This read demo_url_audit_log through the browser Supabase client, which is
 * built against the hosted project - a different log, 5,947 rows there against
 * 6,536 on the VPS, so the figures described neither system accurately.
 *
 * It also counted by pulling 500 rows over and filtering them in the browser,
 * which stops being a count the moment the log passes 500 - it had already
 * passed it more than twelve times over. Both totals come from the endpoint's
 * own count now, so they stay right however large the log grows.
 */
const ProductAnalytics = () => {
  const { t } = useTranslation();
  const all = useResource("demo_audit", { limit: 1 });
  /**
   * "Demo Engagement" counted audit entries with the action `demo_url.test`,
   * and nothing has ever written that action - the log holds demo_url.monitor,
   * .sync, .investigate, .activate, .intake and .create. The card read zero
   * whatever happened. It counts demo opens now, which is the only engagement
   * this module actually records; monitor runs are the platform checking
   * itself, not a visitor opening anything.
   */
  const opens = useResource("demo_clicks", { limit: 1 });
  const isLoading = all.loading || opens.loading;
  // A count that could not be read is a dash, not 0.
  const audit = { length: all.failed ? "—" : all.total };
  const checks = opens.failed ? "—" : opens.total;
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-pink-400" />
            {t("manager.products.analytics_title")}
          </h1>
          <p className="text-slate-400 text-sm">{t("manager.products.analytics_subtitle")}</p>
        </div>
        <Badge variant="outline" className="border-amber-500/50 text-amber-400">
          <Eye className="w-3 h-3 mr-1" />
          {t("manager.products.view_only")}
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
                <p className="text-xs text-slate-400">{t("manager.products.demo_engagement")}</p>
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
                <p className="text-xs text-slate-400">{t("manager.products.tracked_actions")}</p>
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
                <p className="text-xs text-slate-400">{t("manager.products.growth_unavailable")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            {t("manager.products.analytics_data")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-dashed border-slate-700 rounded-lg">
            <p className="text-slate-400">{t("manager.products.no_chart_data")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductAnalytics;
