import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Users,
  UserPlus,
  TrendingUp,
  Headphones,
  Bell,
  ArrowUpRight,
  FileText,
  LogOut,
  Clock,
  Lock,
  Target,
  MessageSquare
} from 'lucide-react';

import { SSMAssignedLeads } from '@/components/sales-support-manager/SSMAssignedLeads';
import { SSMSalesPipeline } from '@/components/sales-support-manager/SSMSalesPipeline';
import { SSMSupportTickets } from '@/components/sales-support-manager/SSMSupportTickets';
import { SSMSLAAlerts } from '@/components/sales-support-manager/SSMSLAAlerts';
import { SSMTeamPerformance } from '@/components/sales-support-manager/SSMTeamPerformance';
import { SSMEscalations } from '@/components/sales-support-manager/SSMEscalations';
import { SSMReportsAudit } from '@/components/sales-support-manager/SSMReportsAudit';
import { toast } from 'sonner';
import { useNavigate } from '@/lib/navigation';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export const SecureSalesSupportManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  
  const [activeTab, setActiveTab] = useState('leads');
  const [sessionTime, setSessionTime] = useState(SESSION_TIMEOUT);
  const [valaId, setValaId] = useState('VL-SSM-XXXXXX');

  useEffect(() => {
    setValaId('VL-SSM-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  }, []);

  // Session timeout management
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => {
        if (prev <= 1000) {
          toast.error('Session expired - logging out');
          navigate('/');
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  // Reset session on activity
  useEffect(() => {
    const resetSession = () => setSessionTime(SESSION_TIMEOUT);
    window.addEventListener('click', resetSession);
    window.addEventListener('keydown', resetSession);
    return () => {
      window.removeEventListener('click', resetSession);
      window.removeEventListener('keydown', resetSession);
    };
  }, []);

  const handleLogout = () => {
    toast.success('Session cleared securely');
    navigate('/');
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const tabItems = [
    { id: 'leads', label: 'New Leads', icon: UserPlus },
    { id: 'pipeline', label: 'Sales Pipeline', icon: TrendingUp },
    { id: 'tickets', label: 'Support Tickets', icon: Headphones },
    { id: 'sla', label: 'SLA Alerts', icon: Bell },
    { id: 'team', label: 'Team Performance', icon: Users },
    { id: 'escalations', label: 'Escalations', icon: ArrowUpRight },
    { id: 'audit', label: 'Reports & Audit', icon: FileText },
  ];

  return (
    <div className="sales-support-manager-theme min-h-screen w-full bg-background text-foreground">
      {/* Security Banner */}
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              <Shield className="h-3 w-3 mr-1" />
              SALES & SUPPORT MANAGER
            </Badge>
            <span className="text-sm font-mono text-muted-foreground">{valaId}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                <Lock className="h-3 w-3 mr-1" />
                Finance BLOCKED
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                <Lock className="h-3 w-3 mr-1" />
                Admin BLOCKED
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={`font-mono ${sessionTime < 300000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formatTime(sessionTime)}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Sales & Support Manager Dashboard
          </h1>
          <p className="text-muted-foreground">
            Customer Experience Core • Sales ≠ Support • SLA Enforced • AI Assisted
          </p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Active Leads</span>
            </div>
            <span className="text-2xl font-bold text-foreground">24</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Open Tickets</span>
            </div>
            <span className="text-2xl font-bold text-foreground">12</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">SLA Alerts</span>
            </div>
            <span className="text-2xl font-bold text-foreground">4</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Team Active</span>
            </div>
            <span className="text-2xl font-bold text-foreground">6</span>
          </motion.div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 flex flex-wrap gap-1">
            {tabItems.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 data-[state=active]:bg-background"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="leads">
            <SSMAssignedLeads />
          </TabsContent>

          <TabsContent value="pipeline">
            <SSMSalesPipeline />
          </TabsContent>

          <TabsContent value="tickets">
            <SSMSupportTickets />
          </TabsContent>

          <TabsContent value="sla">
            <SSMSLAAlerts />
          </TabsContent>

          <TabsContent value="team">
            <SSMTeamPerformance />
          </TabsContent>

          <TabsContent value="escalations">
            <SSMEscalations />
          </TabsContent>

          <TabsContent value="audit">
            <SSMReportsAudit />
          </TabsContent>
        </Tabs>

        {/* Role Separation Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-4 bg-muted/30 border border-border rounded-lg"
        >
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Role Separation Enforced</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Sales ≠ Support - teams are separate and never mixed</li>
                <li>• No lead without owner, No ticket without SLA</li>
                <li>• AI suggests, humans decide - Auto-convert/close BLOCKED</li>
                <li>• Commission edit BLOCKED, Payout/refund BLOCKED</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SecureSalesSupportManagerDashboard;
