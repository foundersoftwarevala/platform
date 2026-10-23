import { motion, AnimatePresence } from "framer-motion";
import { Bell, Lightbulb, AlertTriangle, TrendingUp, CheckCircle, Zap, X } from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";
import { rndKeys, useNotifications } from "@/hooks/rd-module/useRnDData";
import { dismissNotification, markNotificationsRead } from "@/lib/rd-module/rnd-data.functions";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "idea":
      return <Lightbulb className="w-4 h-4 text-violet-400" />;
    case "trend":
      return <TrendingUp className="w-4 h-4 text-cyan-400" />;
    case "risk":
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case "approval":
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case "feedback":
      return <Zap className="w-4 h-4 text-rose-400" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case "idea":
      return "border-l-violet-500";
    case "trend":
      return "border-l-cyan-500";
    case "risk":
      return "border-l-amber-500";
    case "approval":
      return "border-l-emerald-500";
    case "feedback":
      return "border-l-rose-500";
    default:
      return "border-l-slate-500";
  }
};

export const RnDNotifications = () => {
  const { t } = useTranslation();
  const query = useNotifications();
  const items = query.data ?? [];
  const cache = useQueryClient();
  const dismiss = useServerFn(dismissNotification);
  const markRead = useServerFn(markNotificationsRead);
  const action = useMutation({
    mutationFn: (id: string | null) => (id ? dismiss({ data: { id } }) : markRead({ data: {} })),
    onSuccess: () => cache.invalidateQueries({ queryKey: rndKeys.notifications }),
    onError: (error: Error) => toast.error(error.message),
  });
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <Card className="p-4 bg-slate-900/50 backdrop-blur-xl border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 5 }}
          >
            <Bell className="w-5 h-5 text-violet-400" />
          </motion.div>
          <h3 className="font-semibold text-white">{t("rd.alerts_title")}</h3>
          {unreadCount > 0 && (
            <motion.span
              className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {t("rd.alerts_new_count", { count: unreadCount })}
            </motion.span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={action.isPending || unreadCount === 0}
          onClick={() => action.mutate(null)}
          className="text-xs text-slate-400 hover:text-white"
        >
          {t("rd.alerts_mark_all_read")}
        </Button>
      </div>

      {query.isPending && (
        <p role="status" className="text-sm text-slate-400">
          {t("rd.alerts_loading")}
        </p>
      )}
      {(query.error || action.error) && (
        <p role="alert" className="text-sm text-rose-300">
          {(query.error ?? action.error)?.message}
        </p>
      )}
      {!query.isPending && !query.error && items.length === 0 && (
        <p className="text-sm text-slate-400">{t("rd.alerts_empty")}</p>
      )}
      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {items.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative p-3 rounded-lg bg-slate-800/50 border-l-2 ${getNotificationColor(notification.type)} ${
                !notification.read ? "bg-slate-800/80" : ""
              }`}
            >
              {!notification.read && (
                <motion.div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-500"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-slate-700/50">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{notification.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <time className="text-xs text-slate-500 mt-1" dateTime={notification.created_at}>
                    {new Date(notification.created_at).toLocaleString()}
                  </time>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-slate-700"
                  aria-label={t("rd.alerts_dismiss", { title: notification.title })}
                  disabled={action.isPending}
                  onClick={() => action.mutate(notification.id)}
                >
                  <X className="w-3 h-3 text-slate-400" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
        <span>{t("rd.alerts_footer")}</span>
      </div>
    </Card>
  );
};
