import {
  LayoutGrid, Activity, AlertTriangle, Database, Shield, Clock, Cpu, Network,
  Rocket, Layers, ShoppingCart, Receipt, FileSearch, Settings, List, Gauge,
  Plus, Brain, Terminal, HardDrive, Server, ScrollText, Lock, Wrench,
  type LucideIcon,
} from 'lucide-react';

export type ViewType =
  | 'dashboard' | 'addserver' | 'registry' | 'servers' | 'serverlogin' | 'monitoring'
  | 'aihealth' | 'performance' | 'alerts' | 'uptime' | 'resources' | 'network'
  | 'backups' | 'storage' | 'security' | 'deployments' | 'plans' | 'buy'
  | 'billing' | 'logs' | 'audit' | 'maintenance' | 'reports' | 'settings';

export type NavItem = { id: ViewType; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const primaryItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
  { id: 'alerts', label: 'Alerts & Incidents', icon: AlertTriangle },
  { id: 'aihealth', label: 'AI Health Suggestions', icon: Brain },
];

export const navGroups: NavGroup[] = [
  {
    label: 'Fleet',
    items: [
      { id: 'servers', label: 'Servers', icon: Server },
      { id: 'registry', label: 'Server Registry', icon: List },
      { id: 'addserver', label: 'Add Server', icon: Plus },
      { id: 'serverlogin', label: 'Server Login', icon: Terminal },
    ],
  },
  {
    label: 'Performance',
    items: [
      { id: 'performance', label: 'Performance', icon: Gauge },
      { id: 'resources', label: 'Resource Usage', icon: Cpu },
      { id: 'network', label: 'Network & Traffic', icon: Network },
      { id: 'uptime', label: 'Uptime & SLA', icon: Clock },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'deployments', label: 'Deployments', icon: Rocket },
      { id: 'backups', label: 'Backup Manager', icon: HardDrive },
      { id: 'storage', label: 'Storage', icon: Database },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
  {
    label: 'Governance',
    items: [
      { id: 'security', label: 'Security & Firewall', icon: Shield },
      { id: 'logs', label: 'Logs', icon: ScrollText },
      { id: 'audit', label: 'Audit Trail', icon: Lock },
      { id: 'reports', label: 'Reports', icon: FileSearch },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { id: 'plans', label: 'Explore Plans', icon: Layers },
      { id: 'buy', label: 'Buy New Server', icon: ShoppingCart },
      { id: 'billing', label: 'Billing & Usage', icon: Receipt },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];
