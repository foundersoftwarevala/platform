import {
  CARD_ADAPTERS,
  CARD_GATEWAYS,
  isCardGateway,
  resolveCardConfig,
  type CardGatewayCode,
} from "@/lib/commerce/card-gateways";
import { resolvePayuConfig } from "@/lib/commerce/payu";
import { circuitIsOpen } from "@/lib/commerce/provider-call";

/**
 * Which payment methods a particular buyer can actually use.
 *
 * The answer is worked out from the rails Finance Manager holds — is the rail
 * enabled, does it settle this currency, does it operate in this country, and
 * does the adapter behind it have credentials that resolve. It is never worked
 * out from where the buyer is in a general sense. "Africa means card" is the
 * kind of rule that quietly stops a Nigerian customer from paying with the bank
 * transfer they wanted, and offers a card page to somebody in a country the
 * provider does not serve.
 *
 * A rail that is enabled but has no credentials is not offered. Showing a
 * method that cannot complete a payment is worse than showing one fewer.
 */

export type PaymentOption = {
  code: string;
  displayName: string;
  /** Only ever set for a provider genuinely in use, and only its real name. */
  trustLabel: string | null;
  kind: "card" | "transfer" | "wallet" | "crypto" | "other";
  currencies: string[];
  countries: string[];
  /** Whether a customer can be sent to it right now. */
  ready: boolean;
  reason: string;
};

type RailRow = {
  code: string;
  display_name: string | null;
  enabled: boolean | null;
  supported_currencies: string[] | null;
  supported_countries: string[] | null;
  health_status: string | null;
};

/** Region codes a rail may list, and the ISO countries each one covers. */
const REGION_MEMBERS: Record<string, string[]> = {
  EU: [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
    "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  ],
};

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

async function railRows(): Promise<RailRow[]> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl() || !key) return [];
  try {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/finance_payment_rails` +
        `?select=code,display_name,enabled,supported_currencies,supported_countries,health_status`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!response.ok) return [];
    return (await response.json()) as RailRow[];
  } catch {
    return [];
  }
}

const KIND: Record<string, PaymentOption["kind"]> = {
  flutterwave: "card",
  paystack: "card",
  stripe: "card",
  payu: "card",
  wise: "transfer",
  bank_transfer: "transfer",
  upi: "wallet",
  binance: "crypto",
};

/** Whether credentials for a rail actually resolve, without revealing them. */
async function railHasCredentials(code: string): Promise<boolean> {
  if (isCardGateway(code)) return Boolean(await resolveCardConfig(code));
  if (code === "payu") return Boolean(await resolvePayuConfig());
  // Wise, bank transfer, UPI and Binance are manual rails: their readiness is
  // whether the operator has filled the rail in, which the rail row itself says.
  return true;
}

export async function paymentOptions(input: {
  currency: string;
  country?: string | null;
}): Promise<PaymentOption[]> {
  const currency = input.currency.trim().toUpperCase();
  const country = (input.country ?? "").trim().toUpperCase();
  const rails = await railRows();

  const options = await Promise.all(
    rails.map(async (rail): Promise<PaymentOption> => {
      const code = String(rail.code);
      const currencies = (rail.supported_currencies ?? []).map((c) => String(c).toUpperCase());
      // A region code stands for its members. The Wise rail lists "EU", which
      // is not a country, so every buyer in Germany, France and the rest of the
      // Union was told the rail was not available where they are.
      const countries = (rail.supported_countries ?? []).flatMap((c) => {
        const value = String(c).toUpperCase();
        return REGION_MEMBERS[value] ?? [value];
      });
      const adapter = isCardGateway(code) ? CARD_ADAPTERS[code] : null;

      const base = {
        code,
        displayName: String(rail.display_name ?? code),
        trustLabel: null as string | null,
        kind: KIND[code] ?? "other",
        currencies,
        countries,
      };

      if (!rail.enabled) {
        return { ...base, ready: false, reason: "Not enabled in Finance Manager." };
      }
      if (currencies.length && !currencies.includes(currency)) {
        return { ...base, ready: false, reason: `Does not settle ${currency}.` };
      }
      // An empty country list means the rail is not restricted by country.
      if (country && countries.length && !countries.includes(country)) {
        return { ...base, ready: false, reason: `Not available in ${country}.` };
      }
      if (rail.health_status === "down") {
        return { ...base, ready: false, reason: "The provider is reporting an outage." };
      }
      // The rail may be perfectly well configured and simply not answering. The
      // circuit breaker knows that from our own recent calls, which is more
      // current than any stored health column. This is the same eligibility
      // question as the ones above — is this method usable right now — and not
      // a failover: nothing is moved to another provider, the customer is
      // simply not sent to one that cannot take the payment.
      if (circuitIsOpen(code)) {
        return { ...base, ready: false, reason: "The provider is not responding right now." };
      }
      if (!(await railHasCredentials(code))) {
        return { ...base, ready: false, reason: "No credentials configured yet." };
      }

      return {
        ...base,
        // The badge names the provider only once that provider is really the
        // one taking the payment.
        trustLabel: adapter?.trustLabel ?? null,
        ready: true,
        reason: "Available.",
      };
    }),
  );

  // Ready first, then card rails ahead of manual ones, then by name, so the
  // checkout's default is a method that can complete without a human step.
  const rank = (option: PaymentOption) =>
    (option.ready ? 0 : 100) + (option.kind === "card" ? 0 : 10);
  return options.sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName));
}

/**
 * The card gateway to use when the checkout did not name one.
 *
 * Picks the first configured card provider that settles the order's currency in
 * the buyer's country. Returns null rather than guessing when none does.
 */
export async function defaultCardGateway(input: {
  currency: string;
  country?: string | null;
}): Promise<CardGatewayCode | null> {
  const options = await paymentOptions(input);
  // PayU needs no exclusion here: it is not in CARD_GATEWAYS, so isCardGateway
  // has already ruled it out. Testing for it as well made TypeScript compare
  // two types that can never be equal.
  const ready = options.find((option) => option.ready && isCardGateway(option.code));
  return ready && isCardGateway(ready.code) ? ready.code : null;
}

/** Every card provider this codebase has an adapter for, configured or not. */
export function knownCardGateways(): readonly CardGatewayCode[] {
  return CARD_GATEWAYS;
}
