import {
  Activity,
  Bot,
  Gauge,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import type { NavGroup, NavItem } from "@/components/creator/navigation";

export const chatPrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Live Conversations", icon: MessagesSquare },
  { label: "Handoff Queue", icon: UserCheck },
  { label: "AI Governance", icon: Bot },
];

export const chatGroups: NavGroup[] = [
  {
    label: "Chat Manager",
    items: [
      { label: "Command Console", icon: Gauge },
      { label: "Live Conversations", icon: MessagesSquare },
      { label: "Handoff Queue", icon: UserCheck },
      { label: "AI Governance", icon: Bot },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Role Access Matrix", icon: KeyRound },
      { label: "Security Policy", icon: ShieldCheck },
      { label: "Audit Trail", icon: ScrollText },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Participants", icon: Users },
      { label: "Activity", icon: Activity },
    ],
  },
];
