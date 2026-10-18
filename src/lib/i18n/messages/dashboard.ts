/**
 * The shared role dashboard (src/components/dashboard): the sidebar, the top
 * bar, the hero banner, the KPI grid and toolbar and the home screen's
 * content rows, which every role dashboard renders, plus the Developer
 * role's own copy from src/lib/roles.ts. English only.
 *
 * Role names, module names and KPI names reach these strings as variables
 * ({role}, {module}); they are translated by their own keys before they are
 * put in.
 */
export const DASHBOARD_MESSAGES = {
  // Sidebar (src/components/dashboard/Sidebar.tsx)
  "dashboard.sidebar.navigation": [
    "Dashboard navigation",
    "screen-reader name of the dashboard's side menu",
  ],
  "dashboard.sidebar.menu": ["Menu", "heading of the first group in the dashboard side menu"],
  "dashboard.sidebar.dashboard": ["Dashboard", "side menu item that opens the dashboard home"],
  "dashboard.sidebar.pricing_engine": [
    "Pricing Engine",
    "side menu item: the reseller's pricing calculator",
  ],
  "dashboard.sidebar.ai_chat": ["AI Chat", "side menu item that opens the AI assistant chat"],
  "dashboard.sidebar.explore": ["Explore", "side menu item that goes to the home page"],
  "dashboard.sidebar.marketplace": [
    "Marketplace",
    "side menu item that goes to the product catalogue",
  ],
  "dashboard.sidebar.library": ["Library", "side menu item that opens the role's first module"],
  "dashboard.sidebar.role_modules": [
    "{role} Modules",
    "heading over a role's modules; role is the role name, e.g. Developer",
  ],
  "dashboard.sidebar.reseller_centers": [
    "Reseller Centers",
    "heading over the reseller's center screens",
  ],
  "dashboard.sidebar.account": ["Account", "heading of the account group in the side menu"],
  "dashboard.sidebar.settings": ["Settings", "side menu item"],
  "dashboard.sidebar.support": ["Support", "side menu item"],
  "dashboard.sidebar.logout": ["Logout", "side menu item that signs the user out"],
  "dashboard.sidebar.support_unavailable": [
    "Raising a support ticket from the reseller dashboard is not available yet.",
    "notice when a reseller presses Support",
  ],
  "dashboard.sidebar.upgrade": ["Upgrade", "small label on the upgrade card in the side menu"],
  "dashboard.sidebar.go_pro": ["Go Pro", "title of the upgrade card in the side menu"],
  "dashboard.sidebar.upgrade_pitch": "Unlock advanced analytics & AI tools.",
  "dashboard.sidebar.upgrade_now": ["Upgrade now", "button on the upgrade card"],
  "dashboard.sidebar.upgrade_to_pro": [
    "Upgrade to Pro",
    "title of the notice shown by Upgrade now",
  ],
  "dashboard.sidebar.upgrade_billing":
    "Plan upgrades run through your existing Software Vala billing account.",

  // Top bar (src/components/dashboard/TopBar.tsx)
  "dashboard.topbar.marketplace": ["Marketplace", "top bar button back to the marketplace"],
  "dashboard.topbar.search_label": [
    "Search products, orders, users and licenses",
    "screen-reader name of the dashboard search box",
  ],
  "dashboard.topbar.search_placeholder": [
    "Search products, orders, users, licenses…",
    "placeholder of the dashboard search box",
  ],
  "dashboard.topbar.search_no_match": [
    "No {role} module matches “{query}”",
    "the search found no module; role is the role name, query what was typed",
  ],
  "dashboard.topbar.search_hint": "Try a module name such as Orders, Leads or Analytics.",
  "dashboard.topbar.chat": ["Chat", "top bar button that opens the chat"],
  "dashboard.topbar.ai_chat": ["AI Chat", "top bar button that opens the AI assistant chat"],
  "dashboard.topbar.display_currency": [
    "Display currency",
    "screen-reader name of the currency picker",
  ],
  "dashboard.topbar.reseller_rank": "Reseller Rank",
  "dashboard.topbar.reseller_level": "Reseller Level",
  "dashboard.topbar.xp_achievements": ["XP / Achievements", "XP is experience points"],
  "dashboard.topbar.wallet_balance": "Wallet Balance",
  "dashboard.topbar.available_commission": "Available Commission",
  "dashboard.topbar.pending_commission": "Pending Commission",
  "dashboard.topbar.lifetime_earnings": "Lifetime Earnings",
  "dashboard.topbar.pending_payout": "Pending Payout",
  "dashboard.topbar.role_rank_level": [
    "{role} Rank · Level —",
    "tooltip of the rank figure; role is the role name, the dash stands for a level not known yet",
  ],
  "dashboard.topbar.copy_referral_link": ["Copy referral link", "button tooltip"],
  "dashboard.topbar.referral_qr": [
    "Referral QR code",
    "button tooltip, and title of its error notice",
  ],
  "dashboard.topbar.achievement_badges": ["Achievement badges", "button tooltip"],
  "dashboard.topbar.messages": ["Messages", "button tooltip"],
  "dashboard.topbar.referral_link": [
    "Referral link",
    "title of an error notice about the referral link",
  ],
  "dashboard.topbar.referral_link_copied": "Referral link copied",
  "dashboard.topbar.referral_links_unreadable": "Your referral links could not be read",
  "dashboard.topbar.no_referral_link": "No referral link yet",
  "dashboard.topbar.no_referral_link_copy":
    "Create one in the Referral Link Generator, then copy it from here.",
  "dashboard.topbar.no_referral_link_qr":
    "Create one in the Referral Link Generator; its QR code can then be saved from here.",
  "dashboard.topbar.referral_qr_saved": "Referral QR code saved",
  "dashboard.topbar.referral_code": ["Code {code}", "the referral code of the saved QR image"],
  "dashboard.topbar.your_account": ["Your account", "the account menu button"],
  "dashboard.topbar.role_active": [
    "{role} · Active",
    "under the account menu button; role is the role name",
  ],
  "dashboard.topbar.signed_in_as": ["Signed in as {role}", "role is the role name"],
  "dashboard.topbar.profile": ["Profile", "account menu item"],
  "dashboard.topbar.profile_detail": "Profile details come from your existing account system.",
  "dashboard.topbar.switch_role": ["Switch role", "account menu item"],
  "dashboard.topbar.wallet_earnings": ["Wallet & Earnings", "account menu item"],
  "dashboard.topbar.wallet_earnings_notice": [
    "Wallet & earnings",
    "title of the notice from Wallet & Earnings",
  ],
  "dashboard.topbar.wallet_detail": "Balances are read from your existing payouts service.",
  "dashboard.topbar.account_settings": ["Account settings", "account menu item"],
  "dashboard.topbar.account_settings_detail":
    "Managed by your existing Software Vala account system.",
  "dashboard.topbar.sign_out": ["Sign out", "account menu item"],
  "dashboard.topbar.active_roles": ["Active roles", "heading of the role switcher list"],
  "dashboard.topbar.back": ["Back", "returns from the role list to the account menu"],
  "dashboard.topbar.quick_create": ["Quick Create", "tooltip of the Create button"],
  "dashboard.topbar.create": ["Create", "top bar button that opens the quick-create list"],
  "dashboard.topbar.new_product": "New Product",
  "dashboard.topbar.new_order": "New Order",
  "dashboard.topbar.new_customer": "New Customer",
  "dashboard.topbar.new_client": "New Client",
  "dashboard.topbar.new_campaign": "New Campaign",
  "dashboard.topbar.new_coupon": "New Coupon",
  "dashboard.topbar.new_invoice": "New Invoice",
  "dashboard.topbar.new_lead": "New Lead",
  "dashboard.topbar.new_license": "New License",
  "dashboard.topbar.new_ticket": "New Ticket",
  "dashboard.topbar.new_item": ["New {item}", "quick-create entry; item is a module name"],
  "dashboard.topbar.switch_store": ["Switch Store", "tooltip of the store picker"],
  "dashboard.topbar.main_store": ["Main Store", "the account's one storefront"],
  "dashboard.topbar.add_store": ["+ Add Store", "store picker entry that would add a storefront"],
  "dashboard.topbar.add_store_notice": ["Add store", "title of the notice from + Add Store"],
  "dashboard.topbar.add_store_detail": "Running more than one storefront is not available yet.",

  // Hero banner (src/components/dashboard/Hero.tsx)
  "dashboard.hero.view_analytics": ["View Analytics", "button on the dashboard banner"],
  "dashboard.hero.benchmarked": [
    "Benchmarked",
    "label over the products this dashboard is modelled on",
  ],
  "dashboard.hero.role": ["Role", "label over the role name on the banner"],
  "dashboard.hero.status": ["Status", "label over the workspace status on the banner"],
  "dashboard.hero.live_workspace": ["Live workspace", "the workspace status"],
  "dashboard.hero.performance": ["Performance", "heading of the banner's chart card"],
  "dashboard.hero.awaiting_data": ["Awaiting data", "badge on the chart card"],
  "dashboard.hero.connect_source": "Connect a data source",
  "dashboard.hero.charts_note": "Charts populate once your backend is wired up.",
  "dashboard.hero.today": ["Today", "period on the chart card"],
  "dashboard.hero.week": ["Week", "period on the chart card"],
  "dashboard.hero.month": ["Month", "period on the chart card"],

  // KPI grid and toolbar (KpiGrid.tsx, KpiToolbar.tsx)
  "dashboard.kpi.not_tracked": ["not tracked yet", "under a figure the platform has no source for"],
  "dashboard.kpi.live": ["live", "under a figure read from real records"],
  "dashboard.kpi.filter": ["Filter", "label before the figure category buttons"],
  "dashboard.kpi.sort": ["Sort figures", "screen-reader name of the sort picker"],
  "dashboard.kpi.sort_default": ["Default order", "sort option"],
  "dashboard.kpi.sort_label_asc": ["Label A → Z", "sort option: by name, ascending"],
  "dashboard.kpi.sort_label_desc": ["Label Z → A", "sort option: by name, descending"],
  "dashboard.kpi.sort_tone": ["By category", "sort option"],
  "dashboard.kpi.tone_all": ["all", "figure category filter: every figure"],
  "dashboard.kpi.tone_brand": ["brand", "figure category filter"],
  "dashboard.kpi.tone_success": ["success", "figure category filter"],
  "dashboard.kpi.tone_warning": ["warning", "figure category filter"],
  "dashboard.kpi.tone_danger": ["danger", "figure category filter"],
  "dashboard.kpi.tone_violet": ["violet", "figure category filter"],
  "dashboard.kpi.tone_cyan": ["cyan", "figure category filter"],

  // Content rows (src/components/dashboard/ContentRows.tsx)
  "dashboard.rows.recent": [
    "Recent {module}",
    "card heading; module is the role's first module name",
  ],
  "dashboard.rows.recent_activity": [
    "Recent Activity",
    "card heading when the role has no modules",
  ],
  "dashboard.rows.see_all": ["See all", "card action"],
  "dashboard.rows.none_yet": [
    "No {module} yet",
    "empty state; module is a module name in lower case",
  ],
  "dashboard.rows.no_items_yet": ["No items yet", "empty state when the role has no modules"],
  "dashboard.rows.items_note": "Items from your account will appear here once available.",
  "dashboard.rows.create": ["Create {item}", "button; item is a module name"],
  "dashboard.rows.create_item": ["Create item", "button when the role has no modules"],
  "dashboard.rows.quick_actions": ["Quick Actions", "card heading"],
  "dashboard.rows.customize": ["Customize", "card action"],
  "dashboard.rows.open_module": ["Open module", "under a module name in Quick Actions"],
  "dashboard.rows.activity_feed": ["Activity Feed", "card heading"],
  "dashboard.rows.mark_all_read": ["Mark all read", "card action"],
  "dashboard.rows.feed_not_connected": "The activity feed is not connected yet",
  "dashboard.rows.feed_bell": "Notifications from your account are in the bell at the top.",
  "dashboard.rows.all_caught_up": "All caught up",
  "dashboard.rows.events_note": "Recent events from your workspace will appear here.",
  "dashboard.rows.workspace": ["Workspace", "small label over the role's dashboard title"],
  "dashboard.rows.benchmark": [
    "Benchmark",
    "label over the products this dashboard is modelled on",
  ],
  "dashboard.rows.modeled_after": [
    "This dashboard is modeled after best-in-class tooling for {role}s.",
    "role is the role name in lower case, e.g. developer",
  ],
  "dashboard.rows.ready_no_data": ["Ready · no data", "status under a module name"],
  "dashboard.rows.open": ["Open →", "opens a module"],

  // The Developer role (src/lib/roles.ts, key "developer")
  "dashboard.role.developer.name": ["Developer", "role name"],
  "dashboard.role.developer.title": "Developer Dashboard",
  "dashboard.role.developer.tagline": "Command center for shipping code",
  "dashboard.role.developer.eyebrow": [
    "Developer Workspace",
    "small label on the developer's banner",
  ],
  "dashboard.role.developer.headline": [
    "Ship code. Earn XP.",
    "banner headline; XP is experience points",
  ],
  "dashboard.role.developer.sub":
    "Tasks, bugs, code review, timers & performance — one command center.",
  "dashboard.role.developer.cta": ["Open Command Center", "banner button"],
  "dashboard.role.developer.module.command_center": ["Command Center", "developer module"],
  "dashboard.role.developer.module.tasks": ["Tasks", "developer module"],
  "dashboard.role.developer.module.bugs": ["Bugs & Issues", "developer module"],
  "dashboard.role.developer.module.code_submission": ["Code Submission", "developer module"],
  "dashboard.role.developer.module.timer": ["Timer & Productivity", "developer module"],
  "dashboard.role.developer.module.ai": ["AI Assistant", "developer module"],
  "dashboard.role.developer.module.performance": ["Performance", "developer module"],
  "dashboard.role.developer.module.wallet": ["Wallet & Payout", "developer module"],
  "dashboard.role.developer.module.chat": ["Team Chat", "developer module"],
  "dashboard.role.developer.module.settings": ["Settings", "developer module"],
  "dashboard.role.developer.kpi.tasks_open": ["Open Tasks", "developer figure"],
  "dashboard.role.developer.kpi.tasks_done": ["Tasks Completed", "developer figure"],
  "dashboard.role.developer.kpi.bugs_open": ["Open Bugs", "developer figure"],
  "dashboard.role.developer.kpi.commits": ["Commits This Week", "developer figure"],
  "dashboard.role.developer.kpi.code_hours": ["Coding Hours", "developer figure"],
  "dashboard.role.developer.kpi.performance": ["Performance Score", "developer figure"],
  "dashboard.role.developer.kpi.payout": ["Payout Pending", "developer figure"],
  "dashboard.role.developer.kpi.streak": [
    "Ship Streak",
    "developer figure: consecutive days with shipped work",
  ],

  // Reasons shown on dashboard actions that have no screen behind them yet
  // (disabled buttons and menu items, and the banner notice).
  "dashboard.sidebar.no_settings": [
    "This dashboard has no settings screen yet.",
    "why Settings is disabled",
  ],
  "dashboard.sidebar.no_plan": [
    "Plans and upgrades are not available for this role yet.",
    "why Upgrade now is disabled",
  ],
  "dashboard.topbar.no_screen": [
    "Not available on this screen.",
    "why an account menu item is disabled",
  ],
  "dashboard.topbar.no_earnings": [
    "This dashboard has no wallet or earnings screen yet.",
    "why Wallet & Earnings is disabled",
  ],
  "dashboard.hero.notice_vendor": [
    "New products are listed by the Software Vala catalogue team; you cannot add one from here yet.",
    "note beside the vendor banner button, which opens the product list instead of a form",
  ],
  "dashboard.hero.notice_author": [
    "New products are uploaded through the Software Vala catalogue team; self-upload is not available yet.",
    "note beside the author banner button, which opens the product list instead of a form",
  ],
  "dashboard.hero.notice_influencer": [
    "Campaigns are created by Software Vala's marketing team and appear here when you are added to one.",
    "note beside the influencer banner button, which opens the campaign list instead of a form",
  ],
  "dashboard.hero.network_unavailable": [
    "The partner network has no page on the platform yet.",
    "why the reseller banner button Explore network is disabled",
  ],
  "dashboard.rows.open_to_view": [
    "Open {module} to see your records",
    "home screen card that reads no records itself; module is a module name",
  ],
  "dashboard.rows.open_to_view_short": [
    "Open to see records",
    "status under a module name in the workspace card",
  ],
} as const;
