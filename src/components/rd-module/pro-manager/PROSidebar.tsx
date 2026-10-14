import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpCircle,
  Bot,
  Bug,
  CalendarClock,
  FileText,
  Gauge,
  Handshake,
  Headphones,
  Key,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Star,
  Timer,
  Users,
  Menu,
} from "lucide-react";
import logo from "@/assets/rd-module/software-vala-logo.png";
import { Button } from "@/components/rd-module/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/rd-module/ui/sheet";
import { cn } from "@/lib/rd-module/utils";

export const proScreens = [
  { id: "pro_dashboard", label: "Pro Dashboard", icon: LayoutDashboard },
  { id: "pro_user_registry", label: "Pro User Registry", icon: Users },
  { id: "product_ownership", label: "Product Ownership", icon: Package },
  { id: "license_domain", label: "License & Domain", icon: Key },
  { id: "support_requests", label: "Support Requests", icon: Headphones },
  { id: "issue_bug_tracker", label: "Issue & Bug Tracker", icon: Bug },
  { id: "premium_assist", label: "Premium Assist", icon: Handshake },
  { id: "promise_sla_tracker", label: "Promise & SLA Tracker", icon: Timer },
  { id: "upgrade_addons", label: "Upgrade & Add-ons", icon: ArrowUpCircle },
  { id: "renewal_expiry", label: "Renewal & Expiry", icon: CalendarClock },
  { id: "usage_limits", label: "Usage & Limits", icon: Gauge },
  { id: "ai_helpdesk", label: "AI Helpdesk", icon: Bot },
  { id: "communication_log", label: "Communication Log", icon: MessageSquare },
  { id: "alerts_escalation", label: "Alerts & Escalation", icon: AlertTriangle },
  { id: "satisfaction_rating", label: "Satisfaction & Rating", icon: Star },
  { id: "compliance_policy", label: "Compliance & Policy", icon: Shield },
  { id: "audit_logs", label: "Audit Logs", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type PROScreen = (typeof proScreens)[number]["id"];

interface PRONavProps {
  activeScreen: PROScreen;
  onScreenChange: (screen: PROScreen) => void;
  badges: Partial<Record<PROScreen, number>>;
}

const PRONavItems = ({
  activeScreen,
  onScreenChange,
  badges,
  animate,
}: PRONavProps & { animate: boolean }) => (
  <>
    {proScreens.map((item, index) => {
      const Icon = item.icon;
      const isActive = activeScreen === item.id;
      const badge = badges[item.id];
      return (
        <motion.button
          key={item.id}
          type="button"
          onClick={() => onScreenChange(item.id)}
          aria-current={isActive ? "page" : undefined}
          initial={animate ? { opacity: 0, x: -16 } : false}
          animate={animate ? { opacity: 1, x: 0 } : false}
          transition={{ delay: index * 0.02 }}
          whileHover={{ x: 4 }}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isActive
              ? "brand-soft border border-border text-foreground shadow-glow"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
        >
          <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", isActive && "text-brand")} />
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          {badge ? (
            <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">
              {badge}
              <span className="sr-only"> open items</span>
            </span>
          ) : null}
        </motion.button>
      );
    })}
  </>
);

const Brand = () => (
  <div className="flex items-center gap-3">
    <img src={logo} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
    <div className="min-w-0">
      <p className="font-display text-sm font-semibold text-foreground">Software Vala</p>
      <p className="text-xs text-brand">Pro Manager</p>
    </div>
  </div>
);

const SupportFooter = () => (
  <div className="border-t border-border p-4">
    <div className="panel flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand"
      >
        PM
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">Premium Support</p>
        <p className="truncate text-xs text-muted-foreground">Internal • governance only</p>
      </div>
    </div>
  </div>
);

export const PROSidebar = (props: PRONavProps) => (
  <aside
    aria-label="Pro Manager screens"
    className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl lg:flex"
  >
    <div className="border-b border-border px-6 py-5">
      <Brand />
    </div>
    <nav
      aria-label="Pro Manager primary"
      className="scroll-slim flex-1 space-y-1 overflow-y-auto p-4"
    >
      <PRONavItems {...props} animate />
    </nav>
    <SupportFooter />
  </aside>
);

/** Off-canvas navigation for viewports below the `lg` breakpoint. */
export const PROMobileNav = (props: PRONavProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open navigation menu"
          className="min-h-11 min-w-11 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 border-border bg-sidebar p-0">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="sr-only">Pro Manager navigation</SheetTitle>
          <Brand />
        </SheetHeader>
        <nav
          aria-label="Pro Manager primary"
          className="scroll-slim flex-1 space-y-1 overflow-y-auto p-4"
        >
          <PRONavItems
            {...props}
            animate={false}
            onScreenChange={(screen) => {
              props.onScreenChange(screen);
              setOpen(false);
            }}
          />
        </nav>
        <SupportFooter />
      </SheetContent>
    </Sheet>
  );
};
