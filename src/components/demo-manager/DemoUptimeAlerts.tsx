import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  Bell, 
  BellRing, 
  CheckCircle, 
  XCircle, 
  Clock,
  Activity,
  RefreshCw,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Eye,
  Server
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Alert {
  id: string;
  demoName: string;
  type: "downtime" | "high_traffic" | "backup_activated";
  message: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  requiresAction: boolean;
  acknowledged: boolean;
}

const DemoUptimeAlerts = () => {
  const { toast } = useToast();
  const [buzzerActive, setBuzzerActive] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

  const [alerts, setAlerts] = useState<Alert[]>([
    { id: "1", demoName: "Finance Portal", type: "downtime", message: "Demo is unresponsive - Server timeout", severity: "critical", timestamp: "2 min ago", requiresAction: true, acknowledged: false },
    { id: "2", demoName: "HR Management", type: "downtime", message: "Connection refused - Port 443 unreachable", severity: "critical", timestamp: "15 min ago", requiresAction: true, acknowledged: false },
    { id: "3", demoName: "CRM Enterprise", type: "high_traffic", message: "High traffic detected - 500+ concurrent users", severity: "warning", timestamp: "32 min ago", requiresAction: false, acknowledged: false },
    { id: "4", demoName: "Inventory System", type: "backup_activated", message: "Primary server down - Backup activated automatically", severity: "info", timestamp: "1 hour ago", requiresAction: false, acknowledged: true },
  ]);

  const uptimeStats = [
    { name: "CRM Enterprise", uptime: 99.9, responseTime: 145, status: "healthy", lastCheck: "30s ago" },
    { name: "E-Commerce Suite", uptime: 99.5, responseTime: 220, status: "healthy", lastCheck: "45s ago" },
    { name: "HR Management", uptime: 87.2, responseTime: 0, status: "down", lastCheck: "15s ago" },
    { name: "Inventory System", uptime: 98.1, responseTime: 180, status: "backup", lastCheck: "1m ago" },
    { name: "Finance Portal", uptime: 72.5, responseTime: 0, status: "down", lastCheck: "10s ago" },
  ];

  const healthLogs = [
    { time: "14:32:15", demo: "Finance Portal", event: "Health check failed", status: "error" },
    { time: "14:32:00", demo: "CRM Enterprise", event: "Health check passed", status: "success" },
    { time: "14:31:45", demo: "HR Management", event: "Connection timeout", status: "error" },
    { time: "14:31:30", demo: "Inventory System", event: "Backup activated", status: "warning" },
    { time: "14:31:15", demo: "E-Commerce Suite", event: "Health check passed", status: "success" },
  ];

  // Buzzer effect for critical unacknowledged alerts
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && !a.acknowledged);

  useEffect(() => {
    if (criticalAlerts.length > 0 && buzzerActive) {
      const interval = setInterval(() => {
        // Visual pulse effect handled by CSS
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [criticalAlerts, buzzerActive]);

  const handleAcknowledge = (alert: Alert) => {
    if (alert.requiresAction) {
      setSelectedAlert(alert);
      setIsActionDialogOpen(true);
    } else {
      acknowledgeAlert(alert.id);
    }
  };

  const acknowledgeAlert = (alertId: string, action?: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
    
    toast({
      title: "Alert Acknowledged",
      description: action ? `Action taken: ${action}` : "Alert has been acknowledged.",
    });
    
    setIsActionDialogOpen(false);
    setActionNote("");
    setSelectedAlert(null);
  };

  const runHealthCheck = () => {
    toast({
      title: "Health Check Initiated",
      description: "Running health checks on all demos...",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "bg-neon-green/20 text-neon-green border-neon-green/30";
      case "down": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "backup": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warning": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "info": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "downtime": return <XCircle className="w-5 h-5 text-red-400" />;
      case "high_traffic": return <Zap className="w-5 h-5 text-orange-400" />;
      case "backup_activated": return <Shield className="w-5 h-5 text-blue-400" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Critical Alert Banner */}
      <AnimatePresence>
        {criticalAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-lg border-2 ${buzzerActive ? 'border-red-500 bg-red-500/10 animate-pulse' : 'border-red-500/50 bg-red-500/5'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BellRing className={`w-6 h-6 text-red-400 ${buzzerActive ? 'animate-bounce' : ''}`} />
                <div>
                  <p className="font-bold text-red-400">CRITICAL ALERT</p>
                  <p className="text-sm text-red-300">{criticalAlerts.length} demo(s) require immediate attention</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBuzzerActive(!buzzerActive)}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  {buzzerActive ? <Volume2 className="w-4 h-4 mr-1" /> : <VolumeX className="w-4 h-4 mr-1" />}
                  {buzzerActive ? "Mute" : "Unmute"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Uptime & Alerts</h1>
          <p className="text-muted-foreground">Real-time monitoring with buzzer alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-neon-green/20 text-neon-green border border-neon-green/30">
            <Activity className="w-3 h-3 mr-1 animate-pulse" />
            LIVE MONITORING
          </Badge>
          <Button onClick={runHealthCheck} className="bg-primary hover:bg-primary/90">
            <RefreshCw className="w-4 h-4 mr-2" />
            Run Health Check
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-neon-green" />
              <Badge className="bg-neon-green/20 text-neon-green text-xs">Online</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">3</p>
            <p className="text-xs text-muted-foreground">Healthy Demos</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <Badge className="bg-red-500/20 text-red-400 text-xs">Down</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">2</p>
            <p className="text-xs text-muted-foreground">Down Demos</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">Pending</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">{alerts.filter(a => !a.acknowledged).length}</p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <Badge className="bg-primary/20 text-primary text-xs">Avg</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">182ms</p>
            <p className="text-xs text-muted-foreground">Response Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Active Alerts
              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <Badge className="bg-red-500/20 text-red-400 ml-auto">
                  {alerts.filter(a => !a.acknowledged).length} pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border ${
                  alert.acknowledged 
                    ? 'bg-background/30 border-border/50 opacity-60' 
                    : alert.severity === 'critical'
                    ? 'bg-red-500/5 border-red-500/30'
                    : 'bg-background/50 border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{alert.demoName}</p>
                        <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <Button 
                      size="sm" 
                      onClick={() => handleAcknowledge(alert)}
                      className={alert.requiresAction ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}
                    >
                      {alert.requiresAction ? "Take Action" : "Acknowledge"}
                    </Button>
                  )}
                  {alert.acknowledged && (
                    <Badge variant="outline" className="text-neon-green border-neon-green/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Resolved
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Uptime Status */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Demo Uptime Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uptimeStats.map((demo, index) => (
              <motion.div
                key={demo.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{demo.name}</span>
                    <Badge className={getStatusColor(demo.status)}>{demo.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{demo.responseTime > 0 ? `${demo.responseTime}ms` : '--'}</span>
                    <span className="text-xs">{demo.lastCheck}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress 
                    value={demo.uptime} 
                    className="flex-1 h-2"
                  />
                  <span className={`text-sm font-medium ${demo.uptime >= 99 ? 'text-neon-green' : demo.uptime >= 90 ? 'text-orange-400' : 'text-red-400'}`}>
                    {demo.uptime}%
                  </span>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Health Check Logs */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Real-time Health Logs
            <Badge variant="outline" className="ml-auto text-xs">Auto-refresh: 30s</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {healthLogs.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-2 rounded-lg hover:bg-background/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground font-mono">{log.time}</span>
                <span className={`w-2 h-2 rounded-full ${
                  log.status === 'success' ? 'bg-neon-green' : 
                  log.status === 'error' ? 'bg-red-400' : 'bg-orange-400'
                }`} />
                <span className="font-medium text-foreground text-sm">{log.demo}</span>
                <span className="text-sm text-muted-foreground">{log.event}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Required Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Action Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="font-medium text-foreground">{selectedAlert?.demoName}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedAlert?.message}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Describe the action taken:</p>
              <Textarea
                placeholder="e.g., Restarted server, Switched to backup, Contacted hosting provider..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="bg-background border-border min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => acknowledgeAlert(selectedAlert?.id || "", actionNote)}
                disabled={!actionNote.trim()}
                className="bg-red-500 hover:bg-red-600"
              >
                Confirm Action
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoUptimeAlerts;
