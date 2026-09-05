/**
 * DEMO MANAGER MAIN CONTENT
 * ==========================
 * Dynamic content based on sidebar selection
 * LOCKED STRUCTURE - NO CHANGES WITHOUT APPROVAL
 */

import { useState } from "react";
import { useNavigate as useRouterNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Terminal, Play, Pause, CheckCircle, AlertTriangle,
  Search, RefreshCw, Users, Activity, Clock, Eye,
  Globe2, Monitor, ChevronRight, Plus, Trash2, Copy,
  Heart, ArrowUpCircle, FolderOpen, Grid3X3, Building2,
  GraduationCap, Stethoscope, Briefcase, Landmark, Home,
  Truck, ShoppingCart, Code2, ExternalLink, Key, ToggleLeft,
  CheckSquare, FileEdit, ImageIcon, Database, FileText, Menu,
  Bug, ListChecks, Gauge, History, Bot, Wrench, Sparkles,
  Zap, ScanLine, CircleDot, Loader2, Store, EyeOff,
  DollarSign, FileStack, Brain, UserCog, Shield, Lock, BookLock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useDemoOverview } from "@/hooks/useDemoOverview";
import { useAuth } from "@/hooks/useAuth";
import DataStateNotice from "./DataStateNotice";
import { useDataRetry } from "@/hooks/useDataRetry";
import { PageShell, PageBanner } from "@/components/layout/PageShell";

interface DemoManagerMainContentProps {
  activeView: string;
}

// View title mapping
const viewTitles: Record<string, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  "live-demo-count": { title: "Live Demo Count", icon: Monitor },
  "demo-health-status": { title: "Demo Health Status", icon: Heart },
  "pending-demo-fix": { title: "Pending Demo Fix", icon: AlertTriangle },
  "demo-upgrade-requests": { title: "Demo Upgrade Requests", icon: ArrowUpCircle },
  "all-demos": { title: "All Demos", icon: Grid3X3 },
  "category-wise-demo": { title: "Category-wise Demo", icon: FolderOpen },
  "industry-wise-demo": { title: "Industry-wise Demo", icon: Building2 },
  "role-wise-demo": { title: "Role-wise Demo", icon: Users },
  "cat-education": { title: "Education Demos", icon: GraduationCap },
  "cat-healthcare": { title: "Healthcare Demos", icon: Stethoscope },
  "cat-business": { title: "Business Demos", icon: Briefcase },
  "cat-government": { title: "Government Demos", icon: Landmark },
  "cat-society-property": { title: "Society / Property Demos", icon: Home },
  "cat-transport-logistics": { title: "Transport / Logistics Demos", icon: Truck },
  "cat-ecommerce": { title: "E-Commerce Demos", icon: ShoppingCart },
  "cat-custom-software": { title: "Custom Software Demos", icon: Code2 },
  "demo-url": { title: "Demo URL Manager", icon: ExternalLink },
  "login-credentials": { title: "Login Credentials", icon: Key },
  "role-login-switch": { title: "Role Login Switch", icon: ToggleLeft },
  "feature-coverage": { title: "Feature Coverage", icon: CheckSquare },
  "active-inactive-status": { title: "Active / Inactive Status", icon: Activity },
  "update-text-content": { title: "Update Text Content", icon: FileText },
  "update-images": { title: "Update Images", icon: ImageIcon },
  "update-dummy-data": { title: "Update Dummy Data", icon: Database },
  "update-pages": { title: "Update Pages", icon: FileStack },
  "update-menu-order": { title: "Update Menu Order", icon: Menu },
  "report-bug": { title: "Report Bug", icon: Bug },
  "view-bug-list": { title: "View Bug List", icon: ListChecks },
  "bug-severity": { title: "Bug Severity", icon: Gauge },
  "bug-status": { title: "Bug Status", icon: Clock },
  "fix-history": { title: "Fix History", icon: History },
  "ai-fix-demo-issue": { title: "AI: Fix Demo Issue", icon: Wrench },
  "ai-upgrade-demo-feature": { title: "AI: Upgrade Demo Feature", icon: Sparkles },
  "ai-optimize-demo-flow": { title: "AI: Optimize Demo Flow", icon: Zap },
  "ai-repair-broken-button": { title: "AI: Repair Broken Button", icon: Plus },
  "ai-health-scan-demo": { title: "AI: Health Scan Demo", icon: ScanLine },
  "pending-upgrade": { title: "Pending Upgrade", icon: CircleDot },
  "approved-upgrade": { title: "Approved Upgrade", icon: CheckCircle },
  "in-progress-upgrade": { title: "In-Progress Upgrade", icon: Loader2 },
  "completed-upgrade": { title: "Completed Upgrade", icon: CheckSquare },
  "button-click-test": { title: "Button Click Test", icon: Plus },
  "flow-test": { title: "Flow Test", icon: Activity },
  "role-access-test": { title: "Role Access Test", icon: Users },
  "ui-integrity-check": { title: "UI Integrity Check", icon: Monitor },
  "demo-visible-marketplace": { title: "Visible on Marketplace", icon: Eye },
  "hide-show-demo": { title: "Hide / Show Demo", icon: EyeOff },
  "sync-demo-data": { title: "Sync Demo Data", icon: RefreshCw },
  "pricing-preview": { title: "Pricing Preview", icon: DollarSign },
  "demo-changes-log": { title: "Demo Changes Log", icon: History },
  "ai-actions-log": { title: "AI Actions Log", icon: Brain },
  "manager-actions-log": { title: "Manager Actions Log", icon: UserCog },
  "demo-lock": { title: "Demo Lock", icon: Lock },
  "read-only-mode": { title: "Read-Only Mode", icon: BookLock },
  "copy-disable": { title: "Copy Disable", icon: Copy },
  "inspect-disable": { title: "Inspect Disable", icon: Search },
};

const DemoManagerMainContent = ({ activeView }: DemoManagerMainContentProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { user } = useAuth();
  const navigate = useRouterNavigate();
  const { retryAll, isRetrying } = useDataRetry();
  const {
    demos,
    requests,
    isDemosLoading,
    isRequestsLoading,
    isFetching,
    demosError,
    requestsError,
    setDemoStatus,
    extendDemo,
    cloneDemo,
    respondToRequest,
    refresh,
  } = useDemoOverview();


  const currentView = viewTitles[activeView] || { title: "Demo Overview", icon: Terminal };
  const ViewIcon = currentView.icon;

  // Action handlers — all writes hit the live Software Vala backend
  const handleStartDemo = async (demoId: string) => {
    try {
      await setDemoStatus.mutateAsync({ id: demoId, status: "active" });
      toast.success("Demo started");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleStopDemo = async (demoId: string) => {
    try {
      await setDemoStatus.mutateAsync({ id: demoId, status: "maintenance" });
      toast.info("Demo paused");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleExtendDemo = async (demoId: string) => {
    try {
      await extendDemo.mutateAsync({ id: demoId, days: 7 });
      toast.success("Demo extended by 7 days");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleCloneDemo = async (demoId: string) => {
    try {
      await cloneDemo.mutateAsync(demoId);
      toast.success("Demo cloned");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleApproveRequest = async (reqId: string) => {
    try {
      await respondToRequest.mutateAsync({ id: reqId, status: "approved" });
      toast.success("Request approved");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      await respondToRequest.mutateAsync({ id: reqId, status: "rejected" });
      toast.info("Request rejected");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleOpenDemo = (url: string) => {
    if (!url) {
      toast.error("No demo URL configured");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyUrl = async (url: string) => {
    if (!url) {
      toast.error("No demo URL configured");
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Demo URL copied");
  };

  const handleRefresh = async () => {
    await Promise.all([refresh(), retryAll()]);
    toast.info("Data refreshed");
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
      case "paused": return "bg-amber-500/20 text-amber-400 border-amber-500/50";
      case "expired": return "bg-red-500/20 text-red-400 border-red-500/50";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/50";
      case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/50";
      case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    }
  };

  const filteredDemos = demos.filter(demo => {
    const matchesSearch = 
      demo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || demo.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalStats = {
    totalDemos: demos.length,
    activeDemos: demos.filter(d => d.status === "running").length,
    totalUsers: demos.reduce((sum, d) => sum + d.activeUsers, 0),
    pendingRequests: requests.length,
    expiringSoon: demos.filter(d => {
      const match = /^(\d+) day/.exec(d.expiresIn);
      return match ? Number(match[1]) <= 7 : false;
    }).length,
  };

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Banner */}
        <PageBanner
          icon={ViewIcon as never}
          eyebrow="Demo Manager • Live Software Control"
          title={currentView.title}
          subtitle="Monitor every live demo, health signal, credential set and upgrade request from one control room."
          action={
            <>
              <Button variant="outline" size="sm" className="icon3d gap-2" onClick={handleRefresh} disabled={isFetching || isRetrying}>
                <RefreshCw className={cn("w-4 h-4", (isFetching || isRetrying) && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                className="btn-glow gap-2"
                onClick={() => navigate({ to: "/product-demo-manager", search: { view: "add-demo" } as never })}
              >
                <Plus className="w-4 h-4" />
                Create Demo
              </Button>
            </>

          }
        />


        {/* Stats Cards — 4K density, 3D bevel + accent glow */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5 crisp-text">
          {[
            { label: "Total Demos", value: totalStats.totalDemos, icon: Terminal, tone: "kpi-primary" },
            { label: "Active Now", value: totalStats.activeDemos, icon: Activity, tone: "kpi-emerald" },
            { label: "Login Roles", value: totalStats.totalUsers, icon: Users, tone: "kpi-sky" },
            { label: "Pending Requests", value: totalStats.pendingRequests, icon: Clock, tone: "kpi-amber" },
            { label: "Expiring Soon", value: totalStats.expiringSoon, icon: AlertTriangle, tone: "kpi-rose" },
          ].map((kpi) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={cn("kpi-tile p-5", kpi.tone)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {kpi.label}
                  </p>
                  <p className="kpi-value mt-2 text-4xl">{kpi.value}</p>
                </div>
                <span className="kpi-icon h-11 w-11 shrink-0">
                  <kpi.icon className="h-5 w-5" />
                </span>
              </div>
            </motion.div>
          ))}
        </div>


        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search demo or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 bg-background/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid gap-6 grid-cols-1 xl:grid-cols-2 crisp-text">
          {/* Demo Instances */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="kpi-icon kpi-primary h-8 w-8"><Terminal className="w-4 h-4" /></span>
              Demo Instances
              <Badge variant="outline" className="ml-1 text-[10px] tabular-nums">{filteredDemos.length}</Badge>
            </h2>
            <DataStateNotice
              isLoading={isDemosLoading}
              error={demosError}
              isEmpty={filteredDemos.length === 0}
              hasSession={Boolean(user)}
              resource="the demo instance list"
              loadingLabel="Loading demos…"
              emptyTitle={demos.length === 0 ? "No demos yet" : "No matches"}
              emptyDescription={
                demos.length === 0
                  ? "No demo instances exist in the backend yet."
                  : "No demos match the current search or status filter."
              }
              emptyIcon={<Terminal className="w-8 h-8 text-muted-foreground" />}
              onRetry={handleRefresh}
            >
            {filteredDemos.map((demo) => (

              <motion.div
                key={demo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="demo-row p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3 pr-24">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="truncate font-semibold tracking-tight text-foreground">{demo.name}</h3>
                      <Badge className={cn("text-[10px] uppercase tracking-wider", getStatusColor(demo.status))}>
                        {demo.status}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{demo.product}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{demo.activeUsers} login roles</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{demo.region}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="uppercase tracking-[0.12em] text-[10px] font-semibold">Health</span>
                    <span className="tabular-nums font-semibold text-foreground">{demo.usagePercent}%</span>
                  </div>
                  <Progress value={demo.usagePercent} className="h-1.5" />
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/40">
                  {demo.status === "running" ? (
                    <Button size="sm" variant="outline" className="icon3d gap-1 text-xs" onClick={() => handleStopDemo(demo.id)}>
                      <Pause className="w-3 h-3" />
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="icon3d gap-1 text-xs" onClick={() => handleStartDemo(demo.id)}>
                      <Play className="w-3 h-3" />
                      Start
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="icon3d gap-1 text-xs" onClick={() => handleExtendDemo(demo.id)}>
                    <Clock className="w-3 h-3" />
                    Extend
                  </Button>
                  <Button size="sm" variant="outline" className="icon3d gap-1 text-xs" onClick={() => handleCloneDemo(demo.id)}>
                    <Copy className="w-3 h-3" />
                    Clone
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="icon3d gap-1 text-xs ml-auto"
                    disabled={!demo.url}
                    onClick={() => handleOpenDemo(demo.url)}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="icon3d gap-1 text-xs"
                    disabled={!demo.url}
                    onClick={() => handleCopyUrl(demo.url)}
                  >
                    <Copy className="w-3 h-3" />
                    URL
                  </Button>
                </div>

                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-border/60 bg-surface/70 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {demo.expiresIn}
                </div>
              </motion.div>
            ))}

            </DataStateNotice>

          </div>

          {/* Demo Requests */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="kpi-icon kpi-amber h-8 w-8"><Clock className="w-4 h-4" /></span>
              Pending Requests
              <Badge variant="outline" className="ml-1 text-[10px] tabular-nums">{requests.length}</Badge>
            </h2>
            <DataStateNotice
              isLoading={isRequestsLoading}
              error={requestsError}
              isEmpty={requests.length === 0}
              hasSession={Boolean(user)}
              resource="pending demo requests"
              loadingLabel="Loading demo requests…"
              emptyTitle="No pending requests"
              emptyDescription="Every demo request has been handled."
              emptyIcon={<Clock className="w-8 h-8 text-muted-foreground" />}
              onRetry={handleRefresh}
            >
            {requests.map((req) => (

              <div key={req.id} className="demo-row p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="truncate font-semibold tracking-tight text-foreground">{req.company}</p>
                      <Badge className={cn("text-[10px] uppercase tracking-wider", getPriorityColor(req.priority))}>
                        {req.priority}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {req.product} • {req.requestedBy} • {req.requestDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="icon3d gap-1 text-xs text-emerald-400 border-emerald-500/50" onClick={() => handleApproveRequest(req.id)}>
                      <CheckCircle className="w-3 h-3" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="icon3d gap-1 text-xs text-red-400 border-red-500/50" onClick={() => handleRejectRequest(req.id)}>
                      <AlertTriangle className="w-3 h-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>

            ))}
            </DataStateNotice>

          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default DemoManagerMainContent;
