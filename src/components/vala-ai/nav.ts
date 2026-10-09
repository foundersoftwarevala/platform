import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  FlaskConical,
  FolderGit2,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  ShieldCheck,
  Tag,
} from "lucide-react";

export const VALA_AI_SECTIONS = [
  {
    id: "command-center",
    path: "/vala-ai",
    label: "Command Center",
    icon: LayoutDashboard,
    group: "main",
  },
  { id: "chat", path: "/vala-ai/chat", label: "AI Task Chat", icon: MessageSquare, group: "main" },
  {
    id: "projects",
    path: "/vala-ai/projects",
    label: "Projects & Requirements",
    icon: FolderGit2,
    group: "main",
  },
  {
    id: "pipeline",
    path: "/vala-ai/pipeline",
    label: "Execution Pipeline",
    icon: GitBranch,
    group: "work",
  },
  { id: "qa", path: "/vala-ai/qa", label: "QA & Verification", icon: FlaskConical, group: "work" },
  {
    id: "releases",
    path: "/vala-ai/releases",
    label: "Versions & Releases",
    icon: Tag,
    group: "work",
  },
  {
    id: "approvals",
    path: "/vala-ai/approvals",
    label: "Approvals",
    icon: ShieldCheck,
    group: "governance",
  },
  {
    id: "activity",
    path: "/vala-ai/activity",
    label: "Activity & Audit",
    icon: Activity,
    group: "governance",
  },
  {
    id: "settings",
    path: "/vala-ai/settings",
    label: "Settings & System",
    icon: SettingsIcon,
    group: "bottom",
  },
] as const;

export const GROUPS = [
  { id: "main", label: null },
  { id: "work", label: "Work" },
  { id: "governance", label: "Governance" },
] as const;

export function useActiveValaSection(): (typeof VALA_AI_SECTIONS)[number] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/vala-ai/tasks"))
    return VALA_AI_SECTIONS.find((s) => s.id === "pipeline")!;
  return (
    VALA_AI_SECTIONS.find((s) => s.path !== "/vala-ai" && pathname.startsWith(s.path)) ??
    VALA_AI_SECTIONS[0]
  );
}

const COLLAPSE_KEY = "vala:sidebar:collapsed";

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  return { collapsed, toggleCollapsed, mobileOpen, setMobileOpen };
}
