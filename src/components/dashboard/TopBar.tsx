import { Search, Bell, MessageSquare, Sparkles, Wallet, Trophy, Zap, ChevronDown, Store, User, Settings, LogOut, Repeat, Check, Plus, Award, Hourglass, Coins, TrendingUp, Link2, QrCode, BadgeCheck } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogoButton } from "./LogoButton";
import { signOut } from "@/lib/auth-bridge";
import { copyToClipboard, notifyPending, readPref, writePref } from "@/lib/ui-actions";
import { ROLES, ROLE_ORDER, type RoleConfig, type RoleKey } from "@/lib/roles";

export function TopBar({ role, onSwitchRole, onOpenAIChat, onOpenModule, allowedRoles }: { role: RoleConfig; onSwitchRole: (r: RoleKey) => void; onOpenAIChat?: () => void; onOpenModule?: (k: string) => void; allowedRoles?: RoleKey[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function runSearch() {
    const q = query.trim();
    if (!q) return;
    const hit = role.modules.find((m) => m.label.toLowerCase().includes(q.toLowerCase()));
    if (hit && onOpenModule) {
      onOpenModule(hit.key);
      setQuery("");
      return;
    }
    notifyPending(`No ${role.name} module matches “${q}”`, "Try a module name such as Orders, Leads or Analytics.");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 lg:px-6 h-16">
      <LogoButton />

      {/* Marketplace quick return */}
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="press-3d hidden md:inline-flex shrink-0 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-foreground/90 hover:bg-surface-2 transition border border-border"
      >
        <Store className="h-3.5 w-3.5" />
        Marketplace
      </button>

      {/* Search */}
      <div className="relative flex-1 min-w-0 max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
          aria-label="Search products, orders, users and licenses"
          type="search"
          placeholder="Search products, orders, users, licenses…"
          className="w-full rounded-xl bg-surface pl-10 pr-20 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring border border-border"
        />
        <kbd aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border">⌘K</kbd>
      </div>

      {/* AI Chat */}
      <button
        onClick={onOpenAIChat}
        className="hidden md:inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-medium text-brand-foreground shadow-glow hover:opacity-95 transition"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI Chat
      </button>


      <SelectChip prefKey="lang" ariaLabel="Interface language" label="EN" options={["EN","HI","AR","ES","FR","DE"]} />
      <SelectChip prefKey="currency" ariaLabel="Display currency" label="USD" options={["USD","INR","EUR","GBP","AED"]} />

      <Divider />

      <StoreSwitcher />

      {role.key === "reseller" ? (
        <>
          <Pill icon={Trophy}     label="—" tone="warning" title="Reseller Rank" />
          <Pill icon={BadgeCheck} label="—" tone="violet"  title="Reseller Level" />
          <Pill icon={Zap}        label="—" tone="violet"  title="XP / Achievements" />
          <Pill icon={Wallet}     label="—" tone="success" title="Wallet Balance" />
          <Pill icon={Coins}      label="—" tone="success" title="Available Commission" />
          <Pill icon={Hourglass}  label="—" tone="warning" title="Pending Commission" />
          <Pill icon={TrendingUp} label="—" tone="success" title="Lifetime Earnings" />
        </>
      ) : (
        <>
          <Pill icon={Trophy}    label="—" tone="warning" title={`${role.name} Rank · Level —`} />
          <Pill icon={Zap}       label="—" tone="violet"  title="XP / Achievements" />
          <Pill icon={Wallet}    label="—" tone="success" title="Wallet Balance" />
          <Pill icon={Hourglass} label="—" tone="warning" title="Pending Payout" />
        </>
      )}

      <Divider />

      <QuickCreate role={role} onOpenModule={onOpenModule} />
      {role.key === "reseller" && (
        <>
          <IconBtn
            icon={Link2}
            title="Copy referral link"
            onClick={() => copyToClipboard(`${window.location.origin}/?ref=${role.key}`, "Referral link copied")}
          />
          <IconBtn
            icon={QrCode}
            title="Referral QR code"
            onClick={() => notifyPending("Referral QR code", "QR codes are generated from your referral link once the referral service is connected.")}
          />
        </>
      )}
      <IconBtn icon={Award} title="Achievement badges" onClick={() => onOpenModule?.("ams")} />
      <ThemeToggle />
      <IconBtn icon={MessageSquare} title="Messages" onClick={() => onOpenAIChat?.()} />
      <IconBtn
        icon={Bell}
        title="Notifications"
        onClick={() => notifyPending("No new notifications", "Alerts appear here as soon as your notification service is connected.")}
      />

      <ProfileMenu role={role} onSwitchRole={onSwitchRole} allowedRoles={allowedRoles} />


    </header>
  );
}

function ProfileMenu({ role, onSwitchRole, allowedRoles }: { role: RoleConfig; onSwitchRole: (r: RoleKey) => void; allowedRoles?: RoleKey[] }) {
  const roleOptions = allowedRoles && allowedRoles.length ? allowedRoles : ROLE_ORDER;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    navigate({ to: "/", replace: true });
  }


  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5 hover:bg-surface-2 transition border border-border"
      >
        <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center text-[11px] font-bold text-brand-foreground">SV</div>
        <div className="hidden xl:block text-left leading-tight">
          <div className="text-xs font-semibold">Your account</div>
          <div className="text-[10px] text-muted-foreground">{role.name} · Active</div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-2xl overflow-hidden animate-scale-in origin-top-right">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-brand grid place-items-center text-sm font-bold text-brand-foreground">SV</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">Your account</div>
                <div className="text-[11px] text-muted-foreground">Signed in as {role.name}</div>
              </div>
            </div>
          </div>

          {!showRoles ? (
            <div className="p-1.5">
              <MenuItem icon={User} label="Profile" onClick={() => { setOpen(false); notifyPending("Profile", "Profile details come from your existing account system."); }} />
              <MenuItem icon={Repeat} label="Switch role" onClick={() => setShowRoles(true)} chevron />
              <MenuItem icon={Wallet} label="Wallet & Earnings" onClick={() => { setOpen(false); notifyPending("Wallet & earnings", "Balances are read from your existing payouts service."); }} />
              <MenuItem icon={Settings} label="Account settings" onClick={() => { setOpen(false); notifyPending("Account settings", "Managed by your existing Software Vala account system."); }} />
              <div className="my-1.5 h-px bg-border" />
              <MenuItem icon={LogOut} label="Sign out" onClick={handleLogout} />
            </div>
          ) : (
            <div className="p-1.5">
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active roles</div>
                <button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setShowRoles(false)}>Back</button>
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                {roleOptions.map((k) => {
                  const r = ROLES[k];
                  const active = k === role.key;
                  return (
                    <button
                      key={k}
                      onClick={() => { onSwitchRole(k); setOpen(false); setShowRoles(false); }}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface transition text-left"
                    >
                      <div className="h-7 w-7 rounded-lg grid place-items-center text-[10px] font-bold text-white"
                           style={{ background: r.banner.gradient }}>
                        {r.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{r.tagline}</div>
                      </div>
                      {active && <Check className="h-4 w-4 text-success" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, chevron,
}: { icon: any; label: string; onClick?: () => void; chevron?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="press-3d w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {chevron && <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />}
    </button>
  );
}

function Divider() {
  return <span className="hidden md:block h-6 w-px bg-border" />;
}

function SelectChip({
  label, options, prefKey, ariaLabel,
}: { label: string; options: string[]; prefKey: string; ariaLabel: string }) {
  const [value, setValue] = useState(label);
  useEffect(() => { setValue(readPref(prefKey, label)); }, [prefKey, label]);
  return (
    <div className="hidden md:flex">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => { setValue(e.target.value); writePref(prefKey, e.target.value); }}
        className="appearance-none rounded-lg bg-surface border border-border px-2.5 py-2 pr-7 text-xs text-foreground/90 hover:bg-surface-2 transition cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o} className="bg-surface">{o}</option>)}
      </select>
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick }: { icon: any; title?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="press-3d relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface hover:bg-surface-2 border border-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function QuickCreate({ role, onOpenModule }: { role: RoleConfig; onOpenModule?: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const map: Record<string, string> = {
    "New Product": "products",
    "New Order": "orders",
    "New Customer": "customers",
    "New Client": "clients",
    "New Campaign": "campaigns",
    "New Coupon": "coupons",
    "New Invoice": "invoices",
    "New Lead": "leads",
    "New License": "licenses",
    "New Ticket": "ams",
  };
  const has = (k: string) => role.modules.some(m => m.key === k);
  const items = Object.keys(map).filter(l => has(map[l]));
  const list = items.length > 0
    ? items
    : role.modules.slice(0, 6).map(m => `New ${m.label.replace(/s$/, "")}`);

  function handle(label: string) {
    setOpen(false);
    const key = map[label] ?? role.modules.find(m => label.toLowerCase().includes(m.label.toLowerCase().replace(/s$/, "")))?.key;
    if (key && onOpenModule) onOpenModule(key);
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen(o => !o)}
        title="Quick Create"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand/15 text-brand hover:bg-brand/25 border border-brand/30 px-2.5 py-2 text-xs font-semibold transition"
      >
        <Plus className="h-3.5 w-3.5" />
        Create
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur shadow-2xl p-1.5 z-50 animate-scale-in origin-top-right">
          {list.map(i => (
            <button key={i} onClick={() => handle(i)} className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-surface transition">
              {i}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StoreSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Main Store");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const stores = ["Main Store", "Wholesale Store", "B2B Storefront", "+ Add Store"];
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch Store"
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border px-2.5 py-2 text-xs font-medium transition"
      >
        <Store className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[7rem]">{active}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-popover/95 backdrop-blur shadow-2xl p-1.5 z-50 animate-scale-in origin-top-right">
          {stores.map(s => (
            <button
              key={s}
              onClick={() => { if (!s.startsWith("+")) setActive(s); setOpen(false); }}
              className="w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 text-sm hover:bg-surface transition"
            >
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{s}</span>
              {s === active && <Check className="h-3.5 w-3.5 text-success" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function Pill({ icon: Icon, label, tone, title }: { icon: any; label: string; tone: "warning"|"violet"|"success"; title?: string }) {
  const toneMap = {
    warning: "text-warning",
    violet:  "text-[oklch(0.75_0.18_300)]",
    success: "text-success",
  } as const;
  return (
    <div title={title} className="hidden lg:flex items-center gap-1.5 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs">
      <Icon className={`h-3.5 w-3.5 ${toneMap[tone]}`} />
      <span className="font-semibold text-foreground/60">{label}</span>
    </div>
  );
}
