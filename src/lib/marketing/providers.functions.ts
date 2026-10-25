import { createServerFn } from "@tanstack/react-start";

/**
 * Which marketing channels can actually send anything.
 *
 * The Marketing Suite offers twelve channels — email, SMS, WhatsApp, push,
 * Telegram, Discord, social — and not one credential for any of them exists in
 * this environment. Every one of those tabs currently implies a capability the
 * server does not have, and a campaign scheduled on any of them would fail at
 * the provider rather than at the button.
 *
 * This is the adapter boundary the spec asks for: one place that says, per
 * channel, whether it is connected and exactly which setting is missing. It
 * runs on the server and returns booleans and variable *names* only — never a
 * value, never a partial key, so nothing sensitive can reach a browser through
 * it.
 *
 * When a provider is configured the entry flips to connected on its own. There
 * is no stored status to go stale.
 */

export type ProviderStatus = {
  channel: string;
  label: string;
  connected: boolean;
  /** Names of the settings this channel needs. Never their values. */
  requires: string[];
  /** Which of those are present. Names only. */
  present: string[];
  note: string;
};

/** True when every named variable is set and non-empty. */
function has(...names: string[]): { ok: boolean; present: string[] } {
  const present = names.filter((n) => (process.env[n] ?? "").trim() !== "");
  return { ok: present.length === names.length, present };
}

/** True when at least one of the named variables is set. */
function hasAny(...names: string[]): { ok: boolean; present: string[] } {
  const present = names.filter((n) => (process.env[n] ?? "").trim() !== "");
  return { ok: present.length > 0, present };
}

export const getMarketingProviders = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ providers: ProviderStatus[]; connected: number; total: number }> => {
    // Which credentials this server holds is for the people who run it. This
    // had no check, so anyone could ask and read the list of names.
    const { requireOperator } = await import("@/lib/auth/require-operator.server");
    await requireOperator("Reading the marketing channels", { alsoAllow: ["marketing", "seo"] });
    const emailPresent = ["RESEND_API_KEY", "SMTP_RELAY_URL", "SMTP_RELAY_TOKEN"].filter(
      (name) => (process.env[name] ?? "").trim() !== "",
    );
    const emailConnected =
      emailPresent.includes("RESEND_API_KEY") ||
      (emailPresent.includes("SMTP_RELAY_URL") && emailPresent.includes("SMTP_RELAY_TOKEN"));
    const sms = hasAny("TWILIO_ACCOUNT_SID", "SMS_PROVIDER_KEY", "MSG91_KEY");
    const whatsapp = hasAny("WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_WA_TOKEN");
    const push = has("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY");
    const telegram = hasAny("TELEGRAM_BOT_TOKEN");
    const discord = hasAny("DISCORD_WEBHOOK_URL", "DISCORD_BOT_TOKEN");
    const social = hasAny("META_PAGE_TOKEN", "X_API_KEY", "LINKEDIN_TOKEN");

    const providers: ProviderStatus[] = [
      {
        channel: "email",
        label: "Email",
        connected: emailConnected,
        requires: ["RESEND_API_KEY", "SMTP_RELAY_URL", "SMTP_RELAY_TOKEN"],
        present: emailPresent,
        note: "Email is connected only when RESEND_API_KEY is set or both SMTP_RELAY_URL and SMTP_RELAY_TOKEN are set.",
      },
      {
        channel: "sms",
        label: "SMS",
        connected: sms.ok,
        requires: ["TWILIO_ACCOUNT_SID", "SMS_PROVIDER_KEY", "MSG91_KEY"],
        present: sms.present,
        note: "SMS PROVIDER NOT CONNECTED. Messages cannot be queued for delivery.",
      },
      {
        channel: "whatsapp",
        label: "WhatsApp",
        connected: whatsapp.ok,
        requires: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_WA_TOKEN"],
        present: whatsapp.present,
        note: "Needs an official WhatsApp Business provider. Template approval and opt-in are required before any send.",
      },
      {
        channel: "push",
        label: "Push notifications",
        connected: push.ok,
        requires: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
        present: push.present,
        note: "Web push needs a VAPID key pair. Both halves are required.",
      },
      {
        channel: "telegram",
        label: "Telegram",
        connected: telegram.ok,
        requires: ["TELEGRAM_BOT_TOKEN"],
        present: telegram.present,
        note: "Needs a Bot API token. It stays server-side and is never sent to the browser.",
      },
      {
        channel: "discord",
        label: "Discord",
        connected: discord.ok,
        requires: ["DISCORD_WEBHOOK_URL", "DISCORD_BOT_TOKEN"],
        present: discord.present,
        note: "A webhook URL is enough to post; a bot token allows more.",
      },
      {
        channel: "social",
        label: "Social publishing",
        connected: social.ok,
        requires: ["META_PAGE_TOKEN", "X_API_KEY", "LINKEDIN_TOKEN"],
        present: social.present,
        note: "Each platform needs its own token. Nothing is published without one.",
      },
    ];

    return {
      providers,
      connected: providers.filter((p) => p.connected).length,
      total: providers.length,
    };
  },
);
