import { toast } from "sonner";
import { ChatAppButton } from "@/components/chat/ChatAppButton";
import {
  Search,
  MessageSquare,
  Sparkles,
  Wallet,
  Trophy,
  Zap,
  ChevronDown,
  Store,
  User,
  Settings,
  LogOut,
  Repeat,
  Check,
  Plus,
  Award,
  Hourglass,
  Coins,
  TrendingUp,
  Link2,
  QrCode,
  BadgeCheck,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogoButton } from "./LogoButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { signOut } from "@/lib/auth-bridge";
import { useQueryClient } from "@tanstack/react-query";
import { copyToClipboard, notifyPending, readPref, writePref } from "@/lib/ui-actions";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { useResellerOverview } from "@/hooks/useResellerOverview";
import { useTranslation, type Translate } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The reseller's own referral link, from /api/reseller/referral.
 *
 * The copy button used to copy "/?ref=reseller" - the role's name, which is no
 * one's code, so a visit through it was credited to nobody. It now copies the
 * reseller's newest active link, and with none it opens the generator.
 */
async function newestResellerLink(t: Translate) {
  const response = await fetch("/api/reseller/referral", { headers: await authHeaders() });
  const body = (await response.json().catch(() => ({}))) as {
    links?: { code: string; url: string; active: boolean }[];
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? t("dashboard.topbar.referral_links_unreadable"));
  return (body.links ?? []).find((l) => l.active) ?? null;
}

async function copyResellerLink(t: Translate, onOpenModule?: (k: string) => void) {
  try {
    const link = await newestResellerLink(t);
    if (link)
      return copyToClipboard(
        `${window.location.origin}${link.url}`,
        t("dashboard.topbar.referral_link_copied"),
      );
    notifyPending(
      t("dashboard.topbar.no_referral_link"),
      t("dashboard.topbar.no_referral_link_copy"),
    );
    onOpenModule?.("center:referral");
  } catch (error) {
    notifyPending(
      t("dashboard.topbar.referral_link"),
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * A QR code of the same link the copy button copies, saved as a PNG. It used
 * to be a toast saying QR codes would come later.
 */
async function downloadResellerQr(t: Translate, onOpenModule?: (k: string) => void) {
  try {
    const link = await newestResellerLink(t);
    if (!link) {
      notifyPending(
        t("dashboard.topbar.no_referral_link"),
        t("dashboard.topbar.no_referral_link_qr"),
      );
      onOpenModule?.("center:referral");
      return;
    }
    const { default: QRCode } = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(`${window.location.origin}${link.url}`, {
      width: 512,
      margin: 2,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `referral-${link.code}.png`;
    a.click();
    toast.success(t("dashboard.topbar.referral_qr_saved"), {
      description: t("dashboard.topbar.referral_code", { code: link.code }),
    });
  } catch (error) {
    notifyPending(
      t("dashboard.topbar.referral_qr"),
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Dollars for a top-bar pill, at most two decimals, in the interface
 * language's number format; a dash when there is no figure.
 */
function pillUsd(value: number | null | undefined, formatNumber: (value: number) => string) {
  if (value == null) return "—";
  return formatNumber(Math.round(value * 100) / 100);
}
import { ROLES, ROLE_ORDER, type RoleConfig, type RoleKey } from "@/lib/roles";

export function TopBar({
  role,
  onSwitchRole,
  onOpenAIChat,
  onOpenModule,
  allowedRoles,
}: {
  role: RoleConfig;
  onSwitchRole: (r: RoleKey) => void;
  onOpenAIChat?: () => void;
  onOpenModule?: (k: string) => void;
  allowedRoles?: RoleKey[];
}) {
  const navigate = useNavigate();
  const { t, formatNumber } = useTranslation();
  const roleName = role.nameKey ? t(role.nameKey) : role.name;
  // The reseller's rank and commission pills, from their own records
  // (getResellerOverview). Level, XP and a wallet have no reseller source yet,
  // so those stay dashes.
  const { overview: reseller } = useResellerOverview(role.key === "reseller");
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
    // The English name and the name shown in the interface language both match.
    const hit = role.modules.find(
      (m) =>
        m.label.toLowerCase().includes(q.toLowerCase()) ||
        (m.labelKey ? t(m.labelKey).toLowerCase().includes(q.toLowerCase()) : false),
    );
    if (hit && onOpenModule) {
      onOpenModule(hit.key);
      setQuery("");
      return;
    }
    notifyPending(
      t("dashboard.topbar.search_no_match", { role: roleName, query: q }),
      t("dashboard.topbar.search_hint"),
    );
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
        {t("dashboard.topbar.marketplace")}
      </button>

      {/* Search */}
      <div className="relative flex-1 min-w-0 max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
          aria-label={t("dashboard.topbar.search_label")}
          type="search"
          placeholder={t("dashboard.topbar.search_placeholder")}
          className="w-full rounded-xl bg-surface pl-10 pr-20 py-2.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring border border-border"
        />
        {/* i18n-ignore: keyboard shortcut */}
        <kbd
          data-no-translate
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border"
        >
          ⌘K
        </kbd>
      </div>

      {/* Connect Chat — same central chat ecosystem for every dashboard role,
          shown to the roles Chat Manager allows to send messages */}
      <ChatAppButton
        label={t("dashboard.topbar.chat")}
        iconClassName="h-3.5 w-3.5"
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs font-medium text-foreground/90 border border-border hover:bg-surface-2 transition md:px-3"
      />

      {/* AI Chat */}
      <button
        onClick={onOpenAIChat}
        className="hidden md:inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-medium text-brand-foreground shadow-glow hover:opacity-95 transition"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {t("dashboard.topbar.ai_chat")}
      </button>

      {/* Secondary controls from wide-laptop width up (the value pills from 2xl). On a phone they pushed the
          bar 50 px past the screen edge, and on a 768 px tablet still 34 px
          (130 px on the reseller's), and at 1024 px 440 px, so the dashboard
          scrolled sideways;
          search, chat, theme, notifications and the profile menu stay. */}
      {/* From 1280 px the header is only 1024 px beside the sidebar; showing these
          there squeezed the search box to nothing and its input lay over the Chat
          button. Every role now shows them from 2xl, as the reseller already did. */}
      <div className="hidden 2xl:contents">
        {/* i18n-ignore: currency codes */}
        <SelectChip
          prefKey="currency"
          ariaLabel={t("dashboard.topbar.display_currency")}
          label={/* i18n-ignore: ISO currency code */ "USD"}
          options={["USD", "INR", "EUR", "GBP", "AED"]}
        />

        <Divider />

        <StoreSwitcher />

        {role.key === "reseller" ? (
          <>
            <Pill
              wide
              icon={Trophy}
              label={reseller?.rank != null ? `#${reseller.rank}` : "—"}
              tone="warning"
              title={t("dashboard.topbar.reseller_rank")}
            />
            <Pill
              wide
              icon={BadgeCheck}
              label="—"
              tone="violet"
              title={t("dashboard.topbar.reseller_level")}
            />
            <Pill
              wide
              icon={Zap}
              label="—"
              tone="violet"
              title={t("dashboard.topbar.xp_achievements")}
            />
            <Pill
              wide
              icon={Wallet}
              label="—"
              tone="success"
              title={t("dashboard.topbar.wallet_balance")}
            />
            <Pill
              wide
              icon={Coins}
              label={pillUsd(reseller?.earnings.available, formatNumber)}
              tone="success"
              title={t("dashboard.topbar.available_commission")}
            />
            <Pill
              wide
              icon={Hourglass}
              label={pillUsd(reseller?.earnings.pending, formatNumber)}
              tone="warning"
              title={t("dashboard.topbar.pending_commission")}
            />
            <Pill
              wide
              icon={TrendingUp}
              label={pillUsd(reseller?.earnings.lifetime, formatNumber)}
              tone="success"
              title={t("dashboard.topbar.lifetime_earnings")}
            />
          </>
        ) : (
          <>
            <Pill
              icon={Trophy}
              label="—"
              tone="warning"
              title={t("dashboard.topbar.role_rank_level", { role: roleName })}
            />
            <Pill
              icon={Zap}
              label="—"
              tone="violet"
              title={t("dashboard.topbar.xp_achievements")}
            />
            <Pill
              icon={Wallet}
              label="—"
              tone="success"
              title={t("dashboard.topbar.wallet_balance")}
            />
            <Pill
              icon={Hourglass}
              label="—"
              tone="warning"
              title={t("dashboard.topbar.pending_payout")}
            />
          </>
        )}

        <Divider />

        <QuickCreate role={role} onOpenModule={onOpenModule} />
        {role.key === "reseller" && (
          <>
            <IconBtn
              icon={Link2}
              title={t("dashboard.topbar.copy_referral_link")}
              onClick={() => void copyResellerLink(t, onOpenModule)}
            />
            <IconBtn
              icon={QrCode}
              title={t("dashboard.topbar.referral_qr")}
              onClick={() => void downloadResellerQr(t, onOpenModule)}
            />
          </>
        )}
        <IconBtn
          icon={Award}
          title={t("dashboard.topbar.achievement_badges")}
          onClick={() => onOpenModule?.("achievements")}
        />
      </div>
      <ThemeToggle />
      <IconBtn
        icon={MessageSquare}
        title={t("dashboard.topbar.messages")}
        onClick={() => onOpenAIChat?.()}
      />
      <NotificationBell buttonClassName="press-3d relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface hover:bg-surface-2 border border-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />

      <ProfileMenu
        role={role}
        onSwitchRole={onSwitchRole}
        allowedRoles={allowedRoles}
        onOpenModule={onOpenModule}
      />
    </header>
  );
}

/** Roles whose Revenue module is their own earnings (not platform revenue). */
const OWN_REVENUE_ROLES = new Set(["author", "vendor", "influencer", "franchise"]);

/** The role's own wallet / commission / payout screen, if it has one. */
function earningsModule(role: RoleConfig): string | null {
  const has = (k: string) => role.modules.some((m) => m.key === k);
  const own = ["wallet", "commissions", "payouts"].find(has);
  if (own) return own;
  return OWN_REVENUE_ROLES.has(role.key) && has("revenue") ? "revenue" : null;
}

/** The role's settings screen (a reseller's is the Settings Center), if any. */
function settingsModule(role: RoleConfig): string | null {
  if (role.key === "reseller") return "center:settings";
  return role.modules.find((m) => /setting|config|profile/i.test(m.label))?.key ?? null;
}

function ProfileMenu({
  role,
  onSwitchRole,
  allowedRoles,
  onOpenModule,
}: {
  role: RoleConfig;
  onSwitchRole: (r: RoleKey) => void;
  allowedRoles?: RoleKey[];
  onOpenModule?: (k: string) => void;
}) {
  const earningsTarget = earningsModule(role);
  const settingsTarget = settingsModule(role);
  const roleOptions = allowedRoles && allowedRoles.length ? allowedRoles : ROLE_ORDER;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const nameOf = (r: RoleConfig) => (r.nameKey ? t(r.nameKey) : r.name);
  const [open, setOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  async function handleLogout() {
    setOpen(false);
    // See Sidebar: cached records belong to the signed-out user.
    try {
      await signOut();
    } finally {
      queryClient.clear();
      navigate({ to: "/", replace: true });
    }
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
        {/* i18n-ignore: brand initials */}
        <div
          data-no-translate
          className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center text-[11px] font-bold text-brand-foreground"
        >
          SV
        </div>
        <div className="hidden xl:block text-left leading-tight">
          <div className="text-xs font-semibold">{t("dashboard.topbar.your_account")}</div>
          <div className="text-[10px] text-muted-foreground">
            {t("dashboard.topbar.role_active", { role: nameOf(role) })}
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-2xl overflow-hidden animate-scale-in origin-top-right">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {/* i18n-ignore: brand initials */}
              <div
                data-no-translate
                className="h-10 w-10 rounded-xl bg-gradient-brand grid place-items-center text-sm font-bold text-brand-foreground"
              >
                SV
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {t("dashboard.topbar.your_account")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t("dashboard.topbar.signed_in_as", { role: nameOf(role) })}
                </div>
              </div>
            </div>
          </div>

          {!showRoles ? (
            <div className="p-1.5">
              {/* Each opens the role's own screen for it: the profile is the
                  home screen's profile card (an empty module key closes any
                  open module), earnings the role's wallet/commission/revenue
                  module, settings its settings screen. A role with no such
                  screen gets the item disabled with the reason - these used
                  to show notices about account and payout systems that do
                  not exist. */}
              <MenuItem
                icon={User}
                label={t("dashboard.topbar.profile")}
                disabledReason={onOpenModule ? undefined : t("dashboard.topbar.no_screen")}
                onClick={() => {
                  setOpen(false);
                  onOpenModule?.("");
                }}
              />
              <MenuItem
                icon={Repeat}
                label={t("dashboard.topbar.switch_role")}
                onClick={() => setShowRoles(true)}
                chevron
              />
              <MenuItem
                icon={Wallet}
                label={t("dashboard.topbar.wallet_earnings")}
                disabledReason={
                  earningsTarget && onOpenModule ? undefined : t("dashboard.topbar.no_earnings")
                }
                onClick={() => {
                  setOpen(false);
                  if (earningsTarget) onOpenModule?.(earningsTarget);
                }}
              />
              <MenuItem
                icon={Settings}
                label={t("dashboard.topbar.account_settings")}
                disabledReason={
                  settingsTarget && onOpenModule ? undefined : t("dashboard.sidebar.no_settings")
                }
                onClick={() => {
                  setOpen(false);
                  if (settingsTarget) onOpenModule?.(settingsTarget);
                }}
              />
              <div className="my-1.5 h-px bg-border" />
              <MenuItem
                icon={LogOut}
                label={t("dashboard.topbar.sign_out")}
                onClick={handleLogout}
              />
            </div>
          ) : (
            <div className="p-1.5">
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {t("dashboard.topbar.active_roles")}
                </div>
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowRoles(false)}
                >
                  {t("dashboard.topbar.back")}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                {roleOptions.map((k) => {
                  const r = ROLES[k];
                  const active = k === role.key;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        onSwitchRole(k);
                        setOpen(false);
                        setShowRoles(false);
                      }}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface transition text-left"
                    >
                      <div
                        className="h-7 w-7 rounded-lg grid place-items-center text-[10px] font-bold text-white"
                        style={{ background: r.banner.gradient }}
                      >
                        {nameOf(r)[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{nameOf(r)}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {r.taglineKey ? t(r.taglineKey) : r.tagline}
                        </div>
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
  icon: Icon,
  label,
  onClick,
  chevron,
  disabledReason,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  chevron?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabledReason}
      title={disabledReason}
      aria-label={disabledReason ? `${label} - ${disabledReason}` : undefined}
      className="press-3d w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
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
  label,
  options,
  prefKey,
  ariaLabel,
}: {
  label: string;
  options: string[];
  prefKey: string;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(label);
  useEffect(() => {
    setValue(readPref(prefKey, label));
  }, [prefKey, label]);
  return (
    <div className="hidden md:flex">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => {
          setValue(e.target.value);
          writePref(prefKey, e.target.value);
        }}
        className="appearance-none rounded-lg bg-surface border border-border px-2.5 py-2 pr-7 text-xs text-foreground/90 hover:bg-surface-2 transition cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-surface">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function IconBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: any;
  title?: string;
  onClick?: () => void;
}) {
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

/** The shown text of each fixed quick-create entry, by its English label. */
const QUICK_CREATE_TEXT: Record<string, MessageKey> = {
  "New Product": "dashboard.topbar.new_product",
  "New Order": "dashboard.topbar.new_order",
  "New Customer": "dashboard.topbar.new_customer",
  "New Client": "dashboard.topbar.new_client",
  "New Campaign": "dashboard.topbar.new_campaign",
  "New Coupon": "dashboard.topbar.new_coupon",
  "New Invoice": "dashboard.topbar.new_invoice",
  "New Lead": "dashboard.topbar.new_lead",
  "New License": "dashboard.topbar.new_license",
  "New Ticket": "dashboard.topbar.new_ticket",
};

function QuickCreate({
  role,
  onOpenModule,
}: {
  role: RoleConfig;
  onOpenModule?: (k: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
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
  const has = (k: string) => role.modules.some((m) => m.key === k);
  const items = Object.keys(map).filter((l) => has(map[l]));
  const list =
    items.length > 0
      ? items
      : role.modules.slice(0, 6).map((m) => `New ${m.label.replace(/s$/, "")}`);
  const shown = (label: string) =>
    QUICK_CREATE_TEXT[label]
      ? t(QUICK_CREATE_TEXT[label])
      : t("dashboard.topbar.new_item", { item: label.replace(/^New /, "") });

  function handle(label: string) {
    setOpen(false);
    const key =
      map[label] ??
      role.modules.find((m) =>
        label.toLowerCase().includes(m.label.toLowerCase().replace(/s$/, "")),
      )?.key;
    if (key && onOpenModule) onOpenModule(key);
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("dashboard.topbar.quick_create")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand/15 text-brand hover:bg-brand/25 border border-brand/30 px-2.5 py-2 text-xs font-semibold transition"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("dashboard.topbar.create")}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur shadow-2xl p-1.5 z-50 animate-scale-in origin-top-right">
          {list.map((i) => (
            <button
              key={i}
              onClick={() => handle(i)}
              className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-surface transition"
            >
              {shown(i)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StoreSwitcher() {
  const { t } = useTranslation();
  const storeText = (s: string) =>
    s === "Main Store"
      ? t("dashboard.topbar.main_store")
      : s === "+ Add Store"
        ? t("dashboard.topbar.add_store")
        : s;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Main Store");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  // An account has one storefront on the platform. The other two names in this
  // list were invented, and "+ Add Store" did nothing; adding a store is not
  // available yet, and it now says so.
  const stores = ["Main Store", "+ Add Store"];
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("dashboard.topbar.switch_store")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border px-2.5 py-2 text-xs font-medium transition"
      >
        <Store className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[7rem]">{storeText(active)}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-popover/95 backdrop-blur shadow-2xl p-1.5 z-50 animate-scale-in origin-top-right">
          {stores.map((s) => (
            <button
              key={s}
              // Adding a storefront does not exist, so "+ Add Store" is shown
              // disabled with the reason instead of acting.
              disabled={s.startsWith("+")}
              title={s.startsWith("+") ? t("dashboard.topbar.add_store_detail") : undefined}
              aria-label={
                s.startsWith("+")
                  ? `${storeText(s)} - ${t("dashboard.topbar.add_store_detail")}`
                  : undefined
              }
              onClick={() => {
                if (s.startsWith("+")) return;
                setActive(s);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 text-sm hover:bg-surface transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{storeText(s)}</span>
              {s === active && <Check className="h-3.5 w-3.5 text-success" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  tone,
  title,
  wide,
}: {
  icon: any;
  label: string;
  tone: "warning" | "violet" | "success";
  title?: string;
  wide?: boolean;
}) {
  const toneMap = {
    warning: "text-warning",
    violet: "text-[oklch(0.75_0.18_300)]",
    success: "text-success",
  } as const;
  return (
    <div
      title={title}
      className={`${wide ? "hidden min-[2400px]:flex" : "hidden 2xl:flex"} items-center gap-1.5 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs`}
    >
      <Icon className={`h-3.5 w-3.5 ${toneMap[tone]}`} />
      <span className="font-semibold text-foreground/60">{label}</span>
    </div>
  );
}
