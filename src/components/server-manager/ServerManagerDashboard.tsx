// Server Manager Dashboard - Infrastructure Command Center
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Menu, Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useServerDashboard } from '@/hooks/useServerRealtime';
import ScreenErrorBoundary from './ScreenErrorBoundary';
import ScreenSkeleton from './ScreenSkeleton';
import { SMSidebar, useSidebarState } from './layout/SMSidebar';
import { PageShell } from './layout/PageShell';
import type { ViewType } from './layout/views';

// Screens are code-split so the initial dashboard payload stays small.
const SMOverview = lazy(() => import('./screens/SMOverview'));
const SMServices = lazy(() => import('./screens/SMServices'));
const SMUptime = lazy(() => import('./screens/SMUptime'));
const SMIncidents = lazy(() => import('./screens/SMIncidents'));
const SMBackups = lazy(() => import('./screens/SMBackups'));
const SMSecurity = lazy(() => import('./screens/SMSecurity'));
const SMLogs = lazy(() => import('./screens/SMLogs'));
const SMMaintenance = lazy(() => import('./screens/SMMaintenance'));
const SMReports = lazy(() => import('./screens/SMReports'));
const SMAudit = lazy(() => import('./screens/SMAudit'));
const SMRegistry = lazy(() => import('./screens/SMRegistry'));
const SMMonitoring = lazy(() => import('./screens/SMMonitoring'));
const SMPerformance = lazy(() => import('./screens/SMPerformance'));
const SMResources = lazy(() => import('./screens/SMResources'));
const SMNetwork = lazy(() => import('./screens/SMNetwork'));
const SMDeployments = lazy(() => import('./screens/SMDeployments'));
const SMExplorePlans = lazy(() => import('./screens/SMExplorePlans'));
const SMBuyServer = lazy(() => import('./screens/SMBuyServer'));
const SMBilling = lazy(() => import('./screens/SMBilling'));
const SMSettings = lazy(() => import('./screens/SMSettings'));
const SMAddServer = lazy(() => import('./screens/SMAddServer'));
const SMAIHealthSuggestions = lazy(() => import('./screens/SMAIHealthSuggestions'));
const SMServerLogin = lazy(() => import('./screens/SMServerLogin'));
const SMBackupManager = lazy(() => import('./screens/SMBackupManager'));
const SMServers = lazy(() => import('./screens/SMServers'));

const SCREENS: Record<ViewType, React.ComponentType> = {
  dashboard: SMOverview,
  addserver: SMAddServer,
  registry: SMRegistry,
  servers: SMServers,
  serverlogin: SMServerLogin,
  monitoring: SMMonitoring,
  aihealth: SMAIHealthSuggestions,
  performance: SMPerformance,
  alerts: SMIncidents,
  uptime: SMUptime,
  resources: SMResources,
  network: SMNetwork,
  backups: SMBackupManager,
  storage: SMBackups,
  security: SMSecurity,
  deployments: SMDeployments,
  maintenance: SMMaintenance,
  plans: SMExplorePlans,
  buy: SMBuyServer,
  billing: SMBilling,
  reports: SMReports,
  logs: SMLogs,
  audit: SMAudit,
  settings: SMSettings,
};

// SMServices remains reachable from the fleet screens.
void SMServices;

const ServerManagerDashboard = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [sessionTime, setSessionTime] = useState('00:00:00');
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const { summary } = useServerDashboard(10000);

  const infraStatus: 'healthy' | 'warning' | 'critical' =
    summary.critical_alerts > 0 || summary.offline > 0
      ? 'critical'
      : summary.warnings > 0
        ? 'warning'
        : 'healthy';

  const alertBadge = summary.critical_alerts + summary.warnings;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setSessionTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEndSession = async () => {
    try {
      const { error } = await supabase.from('server_audit_logs').insert({
        action: 'secure_logout',
        actor: 'server_manager',
        result: 'success',
        risk_level: 'low',
        details: `Session duration ${sessionTime}`,
      });
      if (error) throw error;
      toast.success('Secure session close recorded');
    } catch (error) {
      console.error('[server-manager] session audit failed', error);
      toast.error('Session recorded locally — audit log write failed');
    }
  };

  const ActiveScreen = useMemo(() => SCREENS[activeView], [activeView]);

  const statusTone =
    infraStatus === 'healthy'
      ? 'text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10'
      : infraStatus === 'warning'
        ? 'text-accent-amber border-accent-amber/30 bg-accent-amber/10'
        : 'text-destructive border-destructive/30 bg-destructive/10';

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      <SMSidebar
        activeView={activeView}
        onSelect={setActiveView}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        alertBadge={alertBadge}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="icon3d grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Infrastructure Command Center</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">Software Vala · Server Manager</p>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <motion.div
              role="status"
              aria-label={`Infrastructure status: ${infraStatus}`}
              className={`hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium md:flex ${statusTone}`}
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {infraStatus === 'healthy' ? 'All Systems Healthy' : infraStatus === 'warning' ? 'Warning' : 'Critical'}
            </motion.div>

            <button
              type="button"
              onClick={() => setActiveView('alerts')}
              aria-label={`Alerts (${alertBadge})`}
              className="icon3d relative grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
              {alertBadge > 0 && (
                <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
                  {alertBadge > 99 ? '99+' : alertBadge}
                </span>
              )}
            </button>

            <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-1.5 text-muted-foreground sm:flex">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono text-xs" aria-label="Session duration">{sessionTime}</span>
            </div>

            <Button variant="outline" size="sm" onClick={handleEndSession}>
              <LogOut className="h-4 w-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">End Session</span>
            </Button>
          </div>
        </header>

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <PageShell>
                <ScreenErrorBoundary screenId={activeView}>
                  <Suspense fallback={<ScreenSkeleton />}>
                    <ActiveScreen />
                  </Suspense>
                </ScreenErrorBoundary>
              </PageShell>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default ServerManagerDashboard;
