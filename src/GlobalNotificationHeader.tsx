import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from "@/hooks/useNavigate";
import { 
  Bell, 
  AlertTriangle, 
  Siren, 
  Shield, 
  Clock, 
  X,
  CheckCircle,
  Info,
  AlertCircle,
  Zap,
  Volume2,
  VolumeX,
  ChevronDown,
  Handshake,
  User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import softwareValaLogo from '@/assets/software-vala-logo.png';

export type NotificationType = 'info' | 'success' | 'warning' | 'danger' | 'priority';

export interface NotificationAlert {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: Date;
  eventType: string;
  actionLabel?: string;
  onAction?: () => void;
  isBuzzer?: boolean;
  roleTarget?: string[];
}

interface GlobalNotificationHeaderProps {
  userRole: string;
  notifications: NotificationAlert[];
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  showPromiseButton?: boolean;
  onPromiseClick?: () => void;
  promiseState?: 'idle' | 'pending' | 'active';
}

const notificationConfig: Record<NotificationType, { color: string; bgColor: string; icon: React.ReactNode; borderColor: string }> = {
  info: { 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/10', 
    borderColor: 'border-blue-500/30',
    icon: <Info className="w-4 h-4" /> 
  },
  success: { 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/10', 
    borderColor: 'border-emerald-500/30',
    icon: <CheckCircle className="w-4 h-4" /> 
  },
  warning: { 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/10', 
    borderColor: 'border-amber-500/30',
    icon: <AlertCircle className="w-4 h-4" /> 
  },
  danger: { 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/10', 
    borderColor: 'border-red-500/30',
    icon: <AlertTriangle className="w-4 h-4" /> 
  },
  priority: { 
    color: 'text-rose-400', 
    bgColor: 'bg-rose-500/20', 
    borderColor: 'border-rose-500/50',
    icon: <Siren className="w-4 h-4" /> 
  },
};

const GlobalNotificationHeader = ({
  userRole,
  notifications,
  onDismiss,
  onAction,
  showPromiseButton = false,
  onPromiseClick,
  promiseState = 'idle'
}: GlobalNotificationHeaderProps) => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [unreadChatCount] = useState(3); // Mock unread chat count

  // Filter notifications based on role
  const filteredNotifications = notifications.filter(n => {
    if (!n.roleTarget || n.roleTarget.length === 0) return true;
    return n.roleTarget.includes(userRole) || userRole === 'boss_owner';
  });

  const buzzerNotifications = filteredNotifications.filter(n => n.isBuzzer && n.type === 'priority');
  const normalNotifications = filteredNotifications.filter(n => !n.isBuzzer);
  const unresolvedCount = filteredNotifications.length;

  useEffect(() => {
    if (buzzerNotifications.length > 0 && !isMuted) {
      setBuzzerActive(true);
    } else {
      setBuzzerActive(false);
    }
  }, [buzzerNotifications.length, isMuted]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'from-rose-500 to-orange-500',
      franchise: 'from-violet-500 to-purple-500',
      reseller: 'from-cyan-500 to-blue-500',
      developer: 'from-emerald-500 to-teal-500',
      seo: 'from-amber-500 to-yellow-500',
      support: 'from-sky-500 to-indigo-500',
      finance: 'from-green-500 to-emerald-500',
      marketing: 'from-pink-500 to-rose-500',
      demo_manager: 'from-indigo-500 to-violet-500',
      client_success: 'from-teal-500 to-cyan-500',
      hr: 'from-purple-500 to-pink-500',
      legal: 'from-cyan-500 to-teal-500',
    };
    return colors[role] || 'from-slate-500 to-gray-500';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Role Badge - Compact */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r ${getRoleBadgeColor(userRole)} shadow-md`}>
        <Shield className="w-3 h-3 text-white" />
        <span className="text-[10px] font-bold text-white uppercase tracking-wide">
          {userRole.replace('_', ' ')}
        </span>
      </div>

      {/* Promise Button - Always Visible, Compact */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPromiseClick}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-medium text-[10px] transition-all ${
          promiseState === 'active'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
            : promiseState === 'pending'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse'
            : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:border-cyan-500/50'
        }`}
      >
        <Handshake className="w-3 h-3" />
        <span className="hidden sm:inline">
          {promiseState === 'active' ? 'Active' : promiseState === 'pending' ? 'Promise' : 'No Task'}
        </span>
      </motion.button>

      {/* Live Counter - Compact */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700/50">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
        />
        <span className="text-[10px] font-medium text-slate-400">
          <span className="text-emerald-400 font-bold">{unresolvedCount}</span>
        </span>
      </div>

      {/* Emergency Beacon (Buzzer) - Compact */}
      <AnimatePresence>
        {buzzerActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="relative"
          >
            <motion.button
              animate={{ 
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 0 0 rgba(239, 68, 68, 0.7)',
                  '0 0 0 6px rgba(239, 68, 68, 0)',
                  '0 0 0 0 rgba(239, 68, 68, 0)'
                ]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              onClick={() => setIsDropdownOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 border border-red-500 text-red-400"
            >
              <Siren className="w-3.5 h-3.5 animate-pulse" />
              <span className="font-bold text-[10px]">BUZZER</span>
              <Badge className="bg-red-500 text-white text-[9px] px-1 h-4">{buzzerNotifications.length}</Badge>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mute Toggle - Compact */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMuted(!isMuted)}
        className={`p-1.5 rounded-md transition-all ${
          isMuted 
            ? 'bg-slate-700/50 text-slate-500' 
            : 'bg-slate-800/50 text-slate-400 hover:text-white'
        }`}
        title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </motion.button>

      {/* Chat Button with Software Vala Logo - Compact */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/personal-chat')}
        className="relative"
        title="Personal Chat"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-500/50 hover:border-emerald-400 transition-all shadow-md hover:shadow-emerald-500/25">
          <img 
            src={softwareValaLogo} 
            alt="Chat" 
            className="w-full h-full object-cover"
          />
        </div>
        {unreadChatCount > 0 && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-emerald-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
          >
            {unreadChatCount > 9 ? '9+' : unreadChatCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notification Bell - Compact */}
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="relative p-1.5 rounded-md bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-all"
        >
          <Bell className="w-4 h-4 text-slate-400" />
          {unresolvedCount > 0 && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-cyan-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            >
              {unresolvedCount > 99 ? '99+' : unresolvedCount}
            </motion.span>
          )}
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {isDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-white">Notifications</span>
                    <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">{unresolvedCount}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700/30">
                      {filteredNotifications.map((notification) => {
                        const config = notificationConfig[notification.type];
                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-4 ${config.bgColor} hover:bg-slate-800/50 transition-colors cursor-pointer group`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                                {config.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={`${config.bgColor} ${config.color} text-[10px] px-1.5`}>
                                    {notification.eventType}
                                  </Badge>
                                  {notification.isBuzzer && (
                                    <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5 animate-pulse">
                                      BUZZER
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-white truncate">{notification.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span className="text-xs text-slate-500">{formatTime(notification.timestamp)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {notification.actionLabel && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAction(notification.id);
                                    }}
                                    className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-xs px-2 py-1 h-auto"
                                  >
                                    {notification.actionLabel}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss(notification.id);
                                  }}
                                  className="text-slate-500 hover:text-white p-1 h-auto"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-slate-400 hover:text-cyan-400"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    View All Notifications
                    <ChevronDown className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GlobalNotificationHeader;
