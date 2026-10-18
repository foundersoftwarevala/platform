import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  X, Bell, Inbox, Volume2,
} from 'lucide-react';

interface SupportNotificationsProps {
  onClose: () => void;
}

type Item = { id: string; type: string; icon: typeof Inbox; title: string; message: string; time: string; read: boolean };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
  return `${Math.floor(mins / 1440)} d ago`;
}

const SupportNotifications = ({ onClose }: SupportNotificationsProps) => {
  // The signed-in agent's own notifications, the same ones the bell shows
  // (user_notifications, through mm_notifications). This panel used to list
  // six invented ones.
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['support-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mm_notifications' as never, { p_limit: 50 } as never);
      if (error) throw new Error(error.message);
      return data as unknown as { notifications?: { id: string; severity: string | null; message: string; event: string | null; read: boolean | null; created_at: string }[] };
    },
    refetchInterval: 60_000,
  });
  const items: Item[] = useMemo(
    () => (query.data?.notifications ?? []).map((n) => ({
      id: n.id,
      type: String(n.event ?? '').includes('escalat') ? 'escalation' : String(n.event ?? '').includes('resolv') ? 'resolved' : 'ticket',
      icon: Inbox,
      title: String(n.event ?? 'Notification').replace(/[._]/g, ' '),
      message: n.message,
      time: timeAgo(n.created_at),
      read: Boolean(n.read),
    })),
    [query.data],
  );
  const notifications = items;
  const readIds = new Set<string>();
  const unreadCount = items.filter((n) => !n.read).length;
  const markAllRead = async () => {
    for (const n of items.filter((x) => !x.read)) {
      await supabase.rpc('mm_notification_read' as never, { p_id: n.id, p_dismiss: false } as never);
    }
    await queryClient.invalidateQueries({ queryKey: ['support-notifications'] });
  };

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
          <span className="text-xs text-muted-foreground">Sounds off</span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-auto max-h-[calc(100vh-180px)]">
        {(query.isLoading || query.isError || notifications.length === 0) && (
          <p className="p-4 text-sm text-muted-foreground">
            {query.isLoading ? 'Loading…' : query.isError ? 'Notifications could not be read.' : 'No notification yet.'}
          </p>
        )}
        {notifications.map((notification, index) => {
          const styles = getTypeStyles(notification.type);
          const isRead = notification.read || readIds.has(notification.id);
          const Icon = notification.icon;

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 border-b border-border hover:bg-card/60 transition-colors cursor-pointer ${
                !isRead ? 'bg-teal-500/5' : ''
              }`}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.bg} border ${styles.border}`}>
                  <Icon className={`w-5 h-5 ${styles.text}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h4 className={`text-sm font-medium ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notification.title}
                    </h4>
                    {!isRead && (
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
        <button
          type="button"
          disabled={!unreadCount}
          onClick={() => void markAllRead()}
          className="w-full py-2.5 rounded-xl bg-card/60 border border-border text-muted-foreground text-sm transition-all hover:border-teal-500/20 hover:text-teal-400 disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          {unreadCount ? `Mark all as read (${unreadCount})` : "All caught up"}
        </button>
      </div>
    </motion.div>
  );
};

export default SupportNotifications;
