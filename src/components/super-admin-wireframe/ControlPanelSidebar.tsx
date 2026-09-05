/**
 * CONTROL PANEL SIDEBAR - FINAL STRUCTURE
 * ========================================
 * FULL HEIGHT (100vh) • ONE SIDEBAR ONLY • PREMIUM CARD-STYLE BUTTONS
 * LOCKED STRUCTURE - BOSS APPROVAL REQUIRED FOR CHANGES
 * 
 * MASTER MODULE ORDER (LOCKED - 8 GRADES):
 * 
 * GRADE 1: Boss Dashboard, CEO Dashboard, Vala AI, Server Manager, AI API Manager
 * GRADE 2: Development Manager, Product Manager, Demo Manager, Task Manager, Promise Tracker, Assist Manager
 * GRADE 3: Marketing Manager, SEO Manager, Lead Manager, Sales & Support, Customer Support
 * GRADE 4: Franchise Owner, Reseller Manager, Influencer Manager, Influencer Dashboard
 * GRADE 5: Continent Admin, Country Admin
 * GRADE 6: Finance Manager, Legal Manager, Developer Dashboard, Pro Manager
 * GRADE 7: Pro User Dashboard, Basic User Dashboard
 * GRADE 8: Home, Security, Settings
 */

import { memo, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  Crown, Eye, Brain, Server, Globe2, Flag, Building2, 
  Headphones, Handshake, Target, Box, Terminal, 
  Star, Scale, ListTodo, DollarSign, Code2, 
  Megaphone, HeartHandshake, Users, LogOut, Zap, Timer, MonitorPlay, 
  Home, Shield, Settings, Search, User, UserCircle, Boxes, Store, Sparkles,
  PanelLeftClose, PanelLeftOpen, MessagesSquare
} from "lucide-react";
// ScrollArea removed - NO SCROLLING in Control Panel

// ===== LOCKED COLORS (SOFTWARE VALA VIOLET GRADIENT) =====
const COLORS = {
  bg: '#0a1428',
  bgGradient: 'linear-gradient(180deg, #10254a 0%, #0b1a35 55%, #060d1d 100%)',
  border: 'rgba(88, 160, 255, 0.32)',
  activeHighlight: '#2f7dff',
  hoverBg: 'rgba(88, 160, 255, 0.22)',
  cardBg: 'rgba(88, 160, 255, 0.12)',
  cardGlow: 'rgba(88, 160, 255, 0.35)',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.7)',
  iconColor: '#bcd8ff',
};

// ===== ROLE CATEGORIES (EXACT ORDER - LOCKED BY GRADE) =====
// IDs MUST match ActiveRole type in RoleSwitchSidebarNew.tsx
const ROLE_CATEGORIES = [
  // GRADE 1
  { id: 'boss_owner', label: 'Boss Dashboard', icon: Crown },
  { id: 'ceo', label: 'CEO Dashboard', icon: Eye },
  { id: 'vala_ai_management', label: 'Vala AI', icon: Brain },
  { id: 'server_manager', label: 'Server Manager', icon: Server },
  { id: 'api_ai_manager', label: 'AI API Manager', icon: Zap },
  // GRADE 2
  { id: 'developer_management', label: 'Development Manager', icon: Code2 },
  { id: 'product_manager', label: 'Product Manager', icon: Box },
  { id: 'demo_manager', label: 'Demo Manager', icon: Terminal },
  { id: 'task_management', label: 'Task Manager', icon: ListTodo },
  { id: 'promise_tracker_manager', label: 'Promise Tracker', icon: Timer },
  { id: 'assist_manager', label: 'Assist Manager', icon: MonitorPlay },
  { id: 'ams_manager', label: 'AMS Manager', icon: Boxes },
  { id: 'marketplace_manager', label: 'Marketplace Manager', icon: Store },
  { id: 'creator_manager', label: 'Creator Manager', icon: Sparkles },



  // GRADE 3
  { id: 'marketing_management', label: 'Marketing Manager', icon: Megaphone },
  { id: 'seo_manager', label: 'SEO Manager', icon: Search },
  { id: 'lead_manager', label: 'Lead Manager', icon: Target },
  { id: 'sales_support_manager', label: 'Sales & Support', icon: Headphones },
  { id: 'chat_manager', label: 'Chat Manager', icon: MessagesSquare },
  { id: 'customer_support_management', label: 'Customer Support', icon: HeartHandshake },
  // GRADE 4
  { id: 'franchise_manager', label: 'Franchise Owner', icon: Building2 },
  { id: 'reseller_manager', label: 'Reseller Manager', icon: Handshake },
  { id: 'influencer_manager', label: 'Influencer Manager', icon: Users },
  { id: 'influencer_dashboard', label: 'Influencer Dashboard', icon: User },
  // GRADE 5
  { id: 'continent_super_admin', label: 'Continent Admin', icon: Globe2 },
  { id: 'country_head', label: 'Country Admin', icon: Flag },
  // GRADE 6
  { id: 'finance_manager', label: 'Finance Manager', icon: DollarSign },
  { id: 'legal_manager', label: 'Legal Manager', icon: Scale },
  { id: 'developer_dashboard', label: 'Developer Dashboard', icon: Code2 },
  { id: 'pro_manager', label: 'Pro Manager', icon: Star },
  // GRADE 7
  { id: 'pro_user_dashboard', label: 'Pro User Dashboard', icon: UserCircle },
  { id: 'basic_user_dashboard', label: 'Basic User Dashboard', icon: User },
  // GRADE 8 (LAST)
  { id: 'home', label: 'Home', icon: Home },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
  // ===== ROLE DASHBOARDS (LAST SECTION — source repo UI, /dashboard/$role) =====
  // Developer Dashboard + Influencer Dashboard already exist above and are wired
  // to their routes instead of being duplicated here.
  { id: 'rd_pro', label: 'Pro Dashboard', icon: Star },
  { id: 'rd_author', label: 'Author Dashboard', icon: UserCircle },
  { id: 'rd_vendor', label: 'Vendor Dashboard', icon: Store },
  { id: 'rd_reseller', label: 'Reseller Dashboard', icon: Handshake },
  { id: 'rd_affiliate', label: 'Affiliate Dashboard', icon: Target },
  { id: 'rd_franchise', label: 'Franchise Dashboard', icon: Building2 },
  { id: 'rd_admin', label: 'Admin Dashboard', icon: Shield },
] as const;

type RoleId = typeof ROLE_CATEGORIES[number]['id'];

interface ControlPanelSidebarProps {
  activeRole?: RoleId;
  onRoleSelect: (roleId: RoleId) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout: () => void;
}

// ===== COMPACT ROLE BUTTON (ICON + ANIMATED LABEL) =====
const RoleButton = memo<{
  role: typeof ROLE_CATEGORIES[number];
  isActive: boolean;
  compact: boolean;
  onClick: () => void;
}>(({ role, isActive, compact, onClick }) => {
  const Icon = role.icon;

  return (
    <button
      onClick={onClick}
      type="button"
      title={compact ? role.label : undefined}
      className={cn(
        "group relative w-full flex items-center gap-2.5 rounded-lg cursor-pointer",
        "px-2 py-1.5 text-left min-h-[32px] border border-transparent",
        "transition-all duration-200 ease-out",
        isActive ? "" : "hover:bg-white/10 hover:translate-x-0.5",
      )}
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${COLORS.activeHighlight} 0%, #48c6ff 100%)`
          : undefined,
        boxShadow: isActive ? '0 10px 26px -12px rgba(50, 140, 255, 0.9)' : undefined,
      }}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white" />
      )}

      {/* Icon */}
      <div className={cn(
        "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-transform duration-200",
        "group-hover:scale-110 group-active:scale-95",
        isActive ? "bg-white/25" : "bg-white/10"
      )}>
        <Icon
          className="w-[15px] h-[15px]"
          style={{ color: isActive ? '#ffffff' : COLORS.iconColor }}
        />
      </div>

      {/* Text */}
      {!compact && (
        <span
          className={cn(
            "text-[12.5px] font-bold truncate leading-tight tracking-tight",
            isActive ? "text-white" : "text-white/85"
          )}
        >
          {role.label}
        </span>
      )}

      {/* Premium tooltip in collapsed mode */}
      {compact && (
        <span className="pointer-events-none absolute left-[105%] z-50 hidden whitespace-nowrap rounded-md border border-primary/40 bg-[#0f2244] px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:block group-hover:opacity-100">
          {role.label}
        </span>
      )}
    </button>
  );
});
RoleButton.displayName = 'RoleButton';

// ===== MAIN SIDEBAR COMPONENT =====
export const SIDEBAR_WIDTH = 244;
export const SIDEBAR_COLLAPSED_WIDTH = 62;

export const ControlPanelSidebar = memo<ControlPanelSidebarProps>(({
  activeRole,
  onRoleSelect,
  collapsed = false,
  onToggleCollapse,
  onLogout,
}) => {
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;
  const compact = !expanded;

  const handleRoleClick = useCallback((roleId: RoleId) => {
    onRoleSelect(roleId);
  }, [onRoleSelect]);

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="flex flex-col flex-shrink-0 fixed left-0 top-0 z-40"
      style={{
        height: '100vh',
        background: COLORS.bgGradient,
        borderRight: `2px solid ${COLORS.border}`,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* HEADER */}
      <div className="px-3 py-2.5 flex-shrink-0 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        {!compact && (
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white tracking-tight truncate">Control Panel</h1>
            <p className="text-[10px] text-white/60 font-medium">Super Admin</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-7 h-7 flex-shrink-0 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* ALL MODULES */}
      <nav className="flex-1 flex flex-col px-2 py-1.5" style={{ gap: '3px' }}>
        {ROLE_CATEGORIES.map((role) => (
          <RoleButton
            key={role.id}
            role={role}
            compact={compact}
            isActive={activeRole === role.id}
            onClick={() => handleRoleClick(role.id)}
          />
        ))}
      </nav>

      {/* STATUS + LOGOUT */}
      <div className="px-2 py-2.5 flex-shrink-0" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        {!compact && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase">Live</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400 uppercase">AI</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[10px] font-bold text-blue-400 uppercase">OK</span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          type="button"
          title="Logout"
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {!compact && <span className="text-[12px] font-semibold">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
});

ControlPanelSidebar.displayName = 'ControlPanelSidebar';
export default ControlPanelSidebar;
export type { RoleId };

