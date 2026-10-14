import { motion, AnimatePresence } from "framer-motion";
import { Bell, Lightbulb, AlertTriangle, TrendingUp, CheckCircle, Zap, X } from "lucide-react";
import { Card } from "@/components/rd-module/ui/card";
import { Button } from "@/components/rd-module/ui/button";
import { useState } from "react";

const notifications = [
  {
    id: "1",
    type: "idea",
    title: "New Idea Submitted",
    message: "AI-Powered Code Review has been added to Future Lab",
    time: "2 min ago",
    read: false,
  },
  {
    id: "2",
    type: "trend",
    title: "Trend Detected",
    message: "New automation opportunity detected. Revenue impact: Medium.",
    time: "15 min ago",
    read: false,
  },
  {
    id: "3",
    type: "risk",
    title: "Risk Alert",
    message: "Prototype 'Holographic Dashboard' performance load exceeds threshold",
    time: "1 hour ago",
    read: true,
  },
  {
    id: "4",
    type: "approval",
    title: "Decision Required",
    message: "One-Click Deployment Pipeline awaiting final approval",
    time: "2 hours ago",
    read: true,
  },
  {
    id: "5",
    type: "feedback",
    title: "Pain Point Threshold",
    message: "User pain point 'deployment speed' exceeds alert threshold",
    time: "3 hours ago",
    read: true,
  },
];

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
  const [items, setItems] = useState(notifications);
  const unreadCount = items.filter((n) => !n.read).length;

  const dismissNotification = (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

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
          <h3 className="font-semibold text-white">R&D Alerts</h3>
          {unreadCount > 0 && (
            <motion.span
              className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {unreadCount} new
            </motion.span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
          Clear All
        </Button>
      </div>

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
                  <p className="text-xs text-slate-500 mt-1">{notification.time}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-slate-700"
                  onClick={() => dismissNotification(notification.id)}
                >
                  <X className="w-3 h-3 text-slate-400" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sound indicator */}
      <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
        <span>🔔 Subtle chime on new alerts</span>
        <Button variant="ghost" size="sm" className="text-xs h-6">
          Settings
        </Button>
      </div>
    </Card>
  );
};
