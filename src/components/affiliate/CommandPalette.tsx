import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { AFFILIATE_NAV } from "@/lib/affiliate-nav";
import {
  BadgeCheck, Banknote, Download, Megaphone, Plus, Upload, UserPlus, Wallet,
} from "lucide-react";

const QUICK_ACTIONS = [
  { label: "New Affiliate", icon: UserPlus },
  { label: "Approve KYC Queue", icon: BadgeCheck },
  { label: "Launch Campaign", icon: Megaphone },
  { label: "Generate Referral Codes", icon: Plus },
  { label: "Issue Payout", icon: Wallet },
  { label: "Adjust Commission", icon: Banknote },
  { label: "Import Affiliates", icon: Upload },
  { label: "Export Report", icon: Download },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search walls, actions, affiliates, campaigns…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {AFFILIATE_NAV.map((n) => (
            <CommandItem key={n.to} value={`nav ${n.label}`} onSelect={() => go(n.to)}>
              <span className="text-muted-foreground">Go to</span>
              <span className="ml-2 font-medium">{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {QUICK_ACTIONS.map((a) => (
            <CommandItem key={a.label} value={`action ${a.label}`} onSelect={() => onOpenChange(false)}>
              <a.icon />
              <span>{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
