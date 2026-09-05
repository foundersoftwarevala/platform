import { useState } from 'react';
import { useNavigate } from "@/hooks/useNavigate";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, Activity, Link2, BarChart3, Package, PlusCircle,
  Monitor, Globe, Settings, LogOut, Lock, AlertTriangle, History,
  FileText, Clock, Eye, Edit, Trash2, RefreshCw, CheckCircle, ArrowLeft, KeyRound
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import DemoManagerTopBar from '@/components/demo-manager/DemoManagerTopBar';
import DemoDashboard from '@/components/demo-manager/DemoDashboard';
import DemoStatusGrid from '@/components/demo-manager/DemoStatusGrid';
import DemoUptimeMonitor from '@/components/demo-manager/DemoUptimeMonitor';
import DemoURLManager from '@/components/demo-manager/DemoURLManager';
import DemoAnalytics from '@/components/demo-manager/DemoAnalytics';
import DemoCatalog from '@/components/demo-manager/DemoCatalog';
import DemoCreator from '@/components/demo-manager/DemoCreator';
import DemoBrokenAlerts from '@/components/demo-manager/DemoBrokenAlerts';
import DemoActivityLogs from '@/components/demo-manager/DemoActivityLogs';
import DemoPendingRequests from '@/components/demo-manager/DemoPendingRequests';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, badge: 'LIVE' },
  { id: 'status', label: 'Demo Status Grid', icon: Activity, badge: '47' },
  { id: 'broken', label: 'Broken Demos', icon: AlertTriangle, badge: '3' },
  { id: 'uptime', label: 'Uptime Monitor', icon: Clock, badge: '99.9%' },
  { id: 'urls', label: 'URL Manager', icon: Link2, badge: null },
  { id: 'analytics', label: 'Click Analytics', icon: BarChart3, badge: null },
  { id: 'catalog', label: 'Demo Catalog', icon: Package, badge: '40+' },
  { id: 'create', label: 'Add Demo', icon: PlusCircle, badge: null },
  { id: 'requests', label: 'Pending Requests', icon: FileText, badge: '5' },
  { id: 'logs', label: 'Activity Log', icon: History, badge: null },
];

const DemoManagerDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return <DemoDashboard />;
      case 'status': return <DemoStatusGrid />;
      case 'broken': return <DemoBrokenAlerts />;
      case 'uptime': return <DemoUptimeMonitor />;
      case 'urls': return <DemoURLManager />;
      case 'analytics': return <DemoAnalytics />;
      case 'catalog': return <DemoCatalog />;
      case 'create': return <DemoCreator />;
      case 'requests': return <DemoPendingRequests />;
      case 'logs': return <DemoActivityLogs />;
      default: return <DemoDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.08),transparent_50%)]" />
        
        {/* Grid Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="demo-grid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-cyan-400" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#demo-grid)" />
        </svg>

        {/* Floating Particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-cyan-400/40 rounded-full"
            style={{
              left: `${10 + (i * 7) % 80}%`,
              top: `${5 + (i * 11) % 85}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div className="pl-64">
        <DemoManagerTopBar 
          onNotificationsClick={() => setShowNotifications(true)}
        />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <motion.aside
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900/80 backdrop-blur-xl border-r border-cyan-500/20 z-50"
        >
          {/* Logo Section */}
          <div className="p-4 border-b border-cyan-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center relative">
                <Monitor className="w-6 h-6 text-white" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/50 to-transparent animate-pulse" />
              </div>
              <div>
                <div className="font-mono font-bold text-sm text-white">SOFTWARE VALA</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono">Demo Manager</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-b border-cyan-500/20">
            <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono text-cyan-400">GLOBAL STATUS</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-mono font-bold text-emerald-400">47</div>
                  <div className="text-[9px] text-slate-400">ACTIVE</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-orange-400">2</div>
                  <div className="text-[9px] text-slate-400">MAINT</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-red-400">1</div>
                  <div className="text-[9px] text-slate-400">DOWN</div>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-380px)]">
            {menuItems.map((item, index) => {
              const isActive = activeSection === item.id;
              const isBroken = item.id === 'broken';
              
              return (
                <motion.button
                  key={item.id}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 text-cyan-400'
                      : isBroken
                      ? 'text-orange-400 hover:bg-orange-500/10'
                      : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : isBroken ? 'text-orange-400' : ''}`} />
                  <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      item.badge === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                        : item.id === 'broken'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* Footer Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyan-500/20 bg-slate-900/90 backdrop-blur-xl space-y-2">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
            <button 
              onClick={() => navigate('/change-password')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all"
            >
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">Change Password</span>
            </button>
            <button 
              onClick={() => navigate('/forgot-password')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all"
            >
              <KeyRound className="w-4 h-4" />
              <span className="text-sm font-medium">Forgot Password</span>
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-6 pt-20 min-h-screen">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default DemoManagerDashboard;
