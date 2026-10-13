export type Col = {
  key: string;
  label: string;
  type?: "text" | "select" | "toggle";
  options?: string[];
};
export type Row = Record<string, string | boolean>;
type Page = { desc: string; add?: string; cols: Col[]; rows: Row[] };

const t = (k: string, l: string): Col => ({ key: k, label: l });
const sel = (k: string, l: string, options: string[]): Col => ({
  key: k,
  label: l,
  type: "select",
  options,
});
const tog = (k: string, l: string): Col => ({ key: k, label: l, type: "toggle" });
const page = (desc: string, add: string, cols: Col[]): Page => ({ desc, add, cols, rows: [] });

const ROLE = ["Owner", "Admin", "Developer", "Support", "Member"];
const STATUS = ["Active", "Paused", "Archived"];

export const PAGES: Record<string, Page> = {
  // ---- Owner ----
  Users: page("Everyone who can use Vala AI.", "Add user", [
    t("name", "Name"),
    t("email", "Email"),
    sel("role", "Role", ROLE),
    tog("active", "Active"),
  ]),
  Roles: page("What each role is allowed to do.", "Add role", [
    t("name", "Role"),
    t("access", "Access"),
    tog("deploy", "Can deploy"),
  ]),
  Lab: page("Builder sessions (websites made in chat).", "New session", [
    t("title", "Title"),
    t("owner", "Owner"),
    sel("status", "Status", ["Building", "Ready", "Published"]),
    t("updated", "Updated"),
  ]),
  Usage: page("AI usage per area.", "Add entry", [
    t("area", "Area"),
    t("requests", "Requests"),
    t("period", "Period"),
  ]),
  "Failed turns": page("AI steps that failed and need a look.", "Log failure", [
    t("where", "Where"),
    t("error", "Error"),
    sel("state", "State", ["Open", "Retried", "Resolved"]),
    t("when", "When"),
  ]),
  Packs: page("Software packs in the library.", "Add pack", [
    t("name", "Pack"),
    t("items", "Items"),
    tog("enabled", "Enabled"),
  ]),
  Credits: page("Internal AI budget per team.", "Add budget", [
    t("team", "Team"),
    t("limit", "Monthly limit"),
    t("used", "Used"),
  ]),
  Referrals: page("Who referred which client.", "Add referral", [
    t("by", "Referred by"),
    t("client", "Client"),
    sel("status", "Status", ["New", "Converted", "Lost"]),
  ]),
  Finance: page("Internal project value tracking (no payments in this app).", "Add entry", [
    t("project", "Project"),
    t("client", "Client"),
    t("value", "Value"),
    sel("status", "Status", ["Quoted", "Approved", "Done"]),
  ]),
  Blog: page("Articles for the Software Vala site.", "New post", [
    t("title", "Title"),
    t("author", "Author"),
    tog("published", "Published"),
  ]),
  Pages: page("Static pages.", "New page", [
    t("title", "Title"),
    t("slug", "URL"),
    tog("published", "Published"),
  ]),
  Languages: page("Languages the interface supports.", "Add language", [
    t("name", "Language"),
    t("code", "Code"),
    tog("enabled", "Enabled"),
  ]),
  "API Integration": page("External systems Vala AI talks to.", "Add integration", [
    t("name", "Name"),
    t("url", "Address"),
    sel("status", "Status", ["Not connected", "Connected", "Error"]),
  ]),
  Sessions: page("Who is signed in right now (managed by Control Panel).", "Add", [
    t("user", "User"),
    t("device", "Device"),
    t("since", "Since"),
  ]),
  "Landing page": page("Sections of the public landing page.", "Add section", [
    t("section", "Section"),
    t("heading", "Heading"),
    tog("visible", "Visible"),
  ]),
  Newsletter: page("Newsletter subscribers.", "Add subscriber", [
    t("email", "Email"),
    sel("status", "Status", ["Subscribed", "Unsubscribed"]),
  ]),
  Contacts: page("Messages from the contact form.", "Add contact", [
    t("name", "Name"),
    t("email", "Email"),
    t("message", "Message"),
    sel("state", "State", ["New", "Replied", "Closed"]),
  ]),
  SEO: page("Search titles and descriptions per page.", "Add page", [
    t("path", "Page"),
    t("title", "Title"),
    t("desc", "Description"),
  ]),
  Marketplace: page("Ready software you can start from.", "Add listing", [
    t("name", "Software"),
    t("category", "Category"),
    tog("listed", "Listed"),
  ]),

  // ---- Admin ----
  "File Manager": page("Files stored for projects.", "Add file", [
    t("name", "File"),
    t("project", "Project"),
    t("size", "Size"),
  ]),
  Database: page("Data areas used by Vala AI.", "Add", [
    t("name", "Area"),
    t("purpose", "Purpose"),
  ]),
  Billing: page("Internal tool — no payments. Track project budgets here.", "Add", [
    t("item", "Item"),
    t("amount", "Amount"),
    t("note", "Note"),
  ]),
  Settings: page("General settings.", "Add setting", [t("name", "Setting"), t("value", "Value")]),
  Subscriptions: page(
    "Internal tool — no subscriptions. Kept for client service plans.",
    "Add plan",
    [t("client", "Client"), t("plan", "Service plan"), sel("status", "Status", STATUS)],
  ),
  Transactions: page("Internal tool — no payments.", "Add", [
    t("ref", "Reference"),
    t("client", "Client"),
    t("amount", "Amount"),
  ]),
  Plans: page("Service levels for clients.", "Add plan", [
    t("name", "Plan"),
    t("includes", "Includes"),
    tog("active", "Active"),
  ]),
  "AI Builders": page("AI agents used in the flow.", "Add agent", [
    t("name", "Agent"),
    t("job", "Job"),
    tog("enabled", "Enabled"),
  ]),
  "AI Providers": page("Where the AI runs.", "Add provider", [
    t("name", "Provider"),
    t("model", "Model"),
    sel("status", "Status", ["In use", "Waiting for details", "Off"]),
  ]),
  "AI Templates": page("Starting prompts for the website builder.", "Add template", [
    t("name", "Template"),
    t("prompt", "Prompt"),
  ]),
};
