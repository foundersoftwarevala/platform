import { useResource } from "@/lib/manager/use-resource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MonitorPlay, TrendingUp, DollarSign, Users, Activity, Zap, ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The studio's own figures, counted by the database.
 *
 * This screen read the browser Supabase client, which is built against the
 * hosted project, while every demo the storefront serves lives on the VPS:
 * hosted holds one product_demo_urls row, the VPS holds seventeen. So an
 * operator opening the dashboard was told the catalogue had one demo.
 *
 * It also fetched all 7,365 products and every demo into the browser only to
 * call .length on them - the shape that under-reports the day a fetch is capped,
 * and it is capped already.
 *
 * Both are fixed by asking /api/manager/resource, which reads the VPS and
 * returns the count separately from the page: four small requests that each
 * bring back four rows and a real total, instead of two that bring back the
 * whole catalogue. Every figure on the screen is unchanged in meaning.
 */
const ProductDashboard = () => {
  const { t } = useTranslation();
  // "Recent" is the newest by when it was added. Both panels used the
  // catalogue's display order, so they showed the same first four products and
  // demos whatever had just been added.
  const products = useResource("products", { limit: 4, sort: "created_at", dir: "desc" });
  // Active means a visitor can see it: visible and published, the storefront's
  // own rule. Visible alone counted drafts.
  const activeProducts = useResource("products", {
    limit: 1,
    filters: ["visible.eq.true", "content_status.eq.published"],
  });
  const demos = useResource("demos", { limit: 4, sort: "created_at", dir: "desc" });
  const activeDemos = useResource("demos", { limit: 1, filters: ["status.eq.active"] });

  const isLoading = products.loading || demos.loading;
  // A count that could not be read is a dash, not 0.
  const count = (state: { total: number; failed: boolean }) => (state.failed ? "—" : state.total);
  const stats = {
    totalProducts: products.total,
    activeProducts: activeProducts.total,
    totalDemos: demos.total,
    activeDemos: activeDemos.total,
    // No source for either yet. A dash is the honest answer, and was already
    // what this screen showed.
    conversionRate: null as number | null,
    totalRevenue: null as number | null,
    recentProducts: products.rows,
    /**
     * The list below renders `demo.name`, and the column is `demo_name` - it
     * always was, in the query this replaced too, so the recent-demos list has
     * been showing blank names the whole time. Mapped here rather than editing
     * the markup, so the screen is untouched.
     */
    recentDemos: demos.rows.map((row) => ({ ...row, name: row.demo_name ?? row.name })),
  };

  const statCards = [
    { 
      label: t("manager.products.total_products"), 
      value: count(products), 
      icon: Package, 
      gradient: "from-violet-600 via-violet-500 to-purple-600",
      glow: "shadow-violet-500/25",
      trend: null,
      trendUp: true
    },
    { 
      label: t("manager.products.active_products"), 
      value: count(activeProducts), 
      icon: Zap, 
      gradient: "from-emerald-600 via-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/25",
      trend: null,
      trendUp: true
    },
    { 
      label: t("manager.products.total_demos"), 
      value: count(demos), 
      icon: MonitorPlay, 
      gradient: "from-blue-600 via-blue-500 to-cyan-600",
      glow: "shadow-blue-500/25",
      trend: null,
      trendUp: true
    },
    { 
      label: t("manager.products.conversion_rate"), 
      value: stats?.conversionRate == null ? "-" : `${stats.conversionRate}%`, 
      icon: TrendingUp, 
      gradient: "from-amber-600 via-amber-500 to-orange-600",
      glow: "shadow-amber-500/25",
      trend: null,
      trendUp: false
    },
    { 
      label: t("manager.products.total_revenue"), 
      value: stats?.totalRevenue == null ? "-" : `₹${(stats.totalRevenue / 1000).toFixed(0)}K`, 
      icon: DollarSign, 
      gradient: "from-pink-600 via-pink-500 to-rose-600",
      glow: "shadow-pink-500/25",
      trend: null,
      trendUp: true
    },
  ];

  const recentProducts = stats?.recentProducts ?? [];
  const recentDemos = stats?.recentDemos ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
          >
            {t("manager.products.dashboard_title")}
          </motion.h1>
          <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            {t("manager.products.dashboard_subtitle")}
          </p>
        </div>
        <Badge className="bg-linear-to-r from-cyan-500/20 to-violet-500/20 text-cyan-400 border-cyan-500/30 px-3 py-1">
          <Sparkles className="w-3 h-3 mr-1" />
          {t("manager.products.live_data")}
        </Badge>
      </div>

      {/* Stats Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        {statCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="group"
          >
            <Card className={`bg-slate-900/50 border-slate-700/50 backdrop-blur-xl overflow-hidden hover:border-slate-600/50 transition-all duration-300 hover:shadow-xl ${stat.glow}`}>
              <CardContent className="p-4 relative">
                {isLoading ? (
                  <Skeleton className="h-16 w-full bg-slate-800" />
                ) : (
                  <>
                    {/* Gradient Glow Effect */}
                    <div className={`absolute -top-10 -right-10 w-24 h-24 bg-linear-to-br ${stat.gradient} rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity`} />
                    
                    <div className="flex items-center gap-4 relative">
                      <motion.div 
                        className={`w-12 h-12 rounded-xl bg-linear-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.glow}`}
                        whileHover={{ rotate: 5 }}
                      >
                        <stat.icon className="w-6 h-6 text-white" />
                      </motion.div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <span className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                            stat.trendUp 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {stat.trend}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{stat.label}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Products */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-violet-400" />
                  {t("manager.products.recent_products")}
                </CardTitle>
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  {t("manager.products.items", { count: recentProducts.length })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800/50">
                {recentProducts.map((product, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="p-4 hover:bg-slate-800/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                          <Package className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-violet-400 transition-colors">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              product.visible
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {product.visible ? t("manager.products.state_active") : t("manager.products.state_inactive")}
                            </span>
                            <span className="text-xs text-slate-500">{product.price_label || t("manager.products.price_not_set")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-400">-</p>
                        <p className="text-xs text-slate-500">{t("manager.products.revenue_unavailable")}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Demos */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-cyan-400" />
                  {t("manager.products.recent_demos")}
                </CardTitle>
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  {t("manager.products.items", { count: recentDemos.length })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800/50">
                {recentDemos.map((demo, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="p-4 hover:bg-slate-800/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                          <MonitorPlay className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">{demo.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                              demo.status === "active"
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {demo.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {demo.status}
                            </span>
                            <span className="text-xs text-slate-500">{demo.last_result || t("manager.products.not_checked")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="ml-13 pl-13">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">{t("manager.products.engagement")}</span>
                        <span className="text-cyan-400">{demo.last_response_ms == null ? "-" : `${demo.last_response_ms} ms`}</span>
                      </div>
                      <Progress value={demo.last_result === "working" ? 100 : demo.last_result === "slow" ? 60 : 0} className="h-1.5 bg-slate-800" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ProductDashboard;
