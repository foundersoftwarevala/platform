import { motion } from 'framer-motion';
import { 
  X, Bell, Inbox, Globe, CheckCircle2, 
  ArrowUpRight, Volume2
} from 'lucide-react';

interface SupportNotificationsProps {
  onClose: () => void;
}

const notifications = [
  {
    id: 1,
    type: 'ticket',
    icon: Inbox,
    title: 'New ticket assigned',
    message: 'POS System - Invoice generation issue',
    time: '2 min ago',
    read: false,
    sound: 'chime'
  },
  {
    id: 2,
    type: 'language',
    icon: Globe,
    title: 'Language auto-detected',
    message: 'Ticket #1247 detected as Hindi → translated',
    time: '5 min ago',
    read: false,
    sound: 'soft'
  },
  {
    id: 3,
    type: 'resolved',
    icon: CheckCircle2,
    title: 'Resolution confirmed',
    message: 'Ticket #1245 marked as resolved by client',
    time: '12 min ago',
    read: true,
    sound: 'success'
  },
  {
    id: 4,
    type: 'escalation',
    icon: ArrowUpRight,
    title: 'Escalation requested',
    message: 'Ticket #1240 needs developer attention',
    time: '18 min ago',
    read: true,
    sound: 'alert'
  },
  {
    id: 5,
    type: 'resolved',
    icon: CheckCircle2,
    title: 'Resolution confirmed',
    message: 'Ticket #1243 - Client satisfaction: 5★',
    time: '25 min ago',
    read: true,
    sound: 'success'
  },
];

const SupportNotifications = ({ onClose }: SupportNotificationsProps) => {
  const getTypeStyles = (type: string) => {
    const styles: Record<string, { bg: string; border: string; text: string }> = {
      ticket: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400' },
      language: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
      resolved: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
      escalation: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
    };
    return styles[type] || styles.ticket;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed right-0 top-16 bottom-0 w-96 bg-card/60 backdrop-blur-2xl border-l border-teal-500/10 z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-teal-400" />
          <h3 className="font-medium text-foreground">Notifications</h3>
          <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 text-xs font-medium">
            {notifications.filter(n => !n.read).length} new
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-card/60 transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Sound Settings */}
      <div className="p-4 border-b border-border bg-card/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Notification sounds</span>
          </div>
          <span className="text-xs text-teal-400">Calm mode enabled</span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-auto max-h-[calc(100vh-180px)]">
        {notifications.map((notification, index) => {
          const styles = getTypeStyles(notification.type);
          const Icon = notification.icon;

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 border-b border-border hover:bg-card/60 transition-colors cursor-pointer ${
                !notification.read ? 'bg-teal-500/5' : ''
              }`}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.bg} border ${styles.border}`}>
                  <Icon className={`w-5 h-5 ${styles.text}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h4 className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notification.title}
                    </h4>
                    {!notification.read && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 bg-teal-400 rounded-full"
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card/60">
        <button className="w-full py-2.5 rounded-xl bg-card/60 border border-border text-muted-foreground text-sm hover:border-teal-500/20 hover:text-teal-400 transition-all">
          Mark all as read
        </button>
      </div>
    </motion.div>
  );
};

export default SupportNotifications;
