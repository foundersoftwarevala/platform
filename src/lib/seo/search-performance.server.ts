/**
 * Search performance from the engines that will tell us: Google Search Console
 * and Bing Webmaster Tools.
 *
 * Section 16 asks for real data and says to mark the provider NOT_CONFIGURED
 * when the credentials are not there. Both providers are already in the API
 * registry - Google Search Console under seo-webmaster with oauth2 and a
 * credential named GOOGLE_SEARCH_CONSOLE_CREDENTIALS, Bing Webmaster Tools
 * with an api_key named BING_WEBMASTER_API_KEY, both free, both with an
 * endpoint recorded. Neither is active and neither credential is present in
 * the server environment, so today every call here returns NOT_CONFIGURED and
 * says which of the two things is missing.
 *
 * That distinction matters. "The service is switched off in the registry" is
 * fixed by an operator in AI API Manager; "the credential is not on the
 * server" is fixed by whoever holds the account. Reporting them as one thing
 * sends the wrong person to look.
 *
 * Nothing here invents a figure. There is no sample data path, no default, and
 * no cached last-known-good: when there is nothing to report the caller is
 * told so.
 */

export type SearchProviderState =
  "READY" | "NOT_REGISTERED" | "NOT_ACTIVE" | "NO_CREDENTIAL" | "NO_ENDPOINT";

export type SearchProviderStatus = {
  provider: string;
  service_id: string | null;
  state: SearchProviderState;
  configured: boolean;
  reason: string;
  /** What an operator has to do next, in the place they would do it. */
  remediation: string;
  auth_type: string | null;
  pricing_tier: string | null;
  credential_env: string | null;
  last_checked: string;
};

export type SearchPerformance = {
  provider: string;
  status: SearchProviderStatus;
  /** Only ever present when status.configured is true. */
  rows: SearchPerformanceRow[] | null;
};

export type SearchPerformanceRow = {
  page: string | null;
  query: string | null;
  country: string | null;
  device: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** The registry names for the two providers section 16 names. */
const PROVIDERS = [
  { key: "google_search_console", service: "Google Search Console" },
  { key: "bing_webmaster", service: "Bing Webmaster Tools" },
] as const;

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

async function rest(path: string) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

type ServiceRow = {
  id: string;
  name: string;
  status: string | null;
  auth_type: string | null;
  pricing_tier: string | null;
  credential_env: string | null;
  endpoint_url: string | null;
};

/**
 * Ask the registry about one provider, and the environment about its key.
 *
 * The registry is the only place that decides whether a provider may be used.
 * This never reaches a provider directly and never falls back to one.
 */
export async function searchProviderStatus(serviceName: string): Promise<SearchProviderStatus> {
  const now = new Date().toISOString();
  const base: Omit<SearchProviderStatus, "state" | "configured" | "reason" | "remediation"> = {
    provider: serviceName,
    service_id: null,
    auth_type: null,
    pricing_tier: null,
    credential_env: null,
    last_checked: now,
  };

  const response = await rest(
    "api_services?select=id,name,status,auth_type,pricing_tier,credential_env,endpoint_url" +
      `&name=eq.${encodeURIComponent(serviceName)}&limit=1`,
  );
  const rows = response.ok ? ((await response.json()) as ServiceRow[]) : [];
  const service = rows[0];

  if (!service) {
    return {
      ...base,
      state: "NOT_REGISTERED",
      configured: false,
      reason: `${serviceName} is not in the API registry.`,
      remediation: "Add the service in AI API Manager before anything can use it.",
    };
  }

  const found = {
    ...base,
    service_id: service.id,
    auth_type: service.auth_type,
    pricing_tier: service.pricing_tier,
    credential_env: service.credential_env,
  };

  if (!service.endpoint_url) {
    return {
      ...found,
      state: "NO_ENDPOINT",
      configured: false,
      reason: `${serviceName} has no execution endpoint recorded.`,
      remediation: "Record the API endpoint against the service in AI API Manager.",
    };
  }

  if (service.status !== "active") {
    return {
      ...found,
      state: "NOT_ACTIVE",
      configured: false,
      reason: `${serviceName} is registered but its status is "${service.status ?? "unset"}".`,
      remediation: "Activate the service in AI API Manager once its credential is in place.",
    };
  }

  const credentialName = (service.credential_env ?? "").trim();
  if (!credentialName || !env(credentialName)) {
    return {
      ...found,
      state: "NO_CREDENTIAL",
      configured: false,
      reason: credentialName
        ? `${serviceName} is active but ${credentialName} is not set on the server.`
        : `${serviceName} is active but names no credential to use.`,
      remediation: credentialName
        ? `Set ${credentialName} in the server environment. It is never read by the browser.`
        : "Record which environment variable holds this service's credential.",
    };
  }

  return {
    ...found,
    state: "READY",
    configured: true,
    reason: `${serviceName} is active and its credential is present.`,
    remediation: "",
  };
}

/**
 * Search performance for one provider.
 *
 * Returns rows only when the provider is genuinely usable. When it is not, the
 * status says which thing is missing and `rows` is null - not an empty array,
 * which a screen would draw as "measured, and there was nothing".
 */
export async function searchPerformance(serviceName: string): Promise<SearchPerformance> {
  const status = await searchProviderStatus(serviceName);
  if (!status.configured) return { provider: serviceName, status, rows: null };

  // The provider is usable. Fetching is deliberately left to the point where a
  // credential exists to test it against: writing a request shape against an
  // API nobody here has ever authenticated to would be guessing, and a guess
  // that returns an empty list is indistinguishable from real silence.
  return {
    provider: serviceName,
    status: {
      ...status,
      state: "READY",
      reason:
        `${serviceName} is configured. The query has not been implemented against ` +
        "a live credential yet, so no figures are reported rather than guessed.",
      remediation:
        "With the credential in place, the request can be built and verified against real data.",
    },
    rows: null,
  };
}

/** Both providers at once, for a screen that shows where search data stands. */
export async function allSearchProviders(): Promise<SearchProviderStatus[]> {
  return Promise.all(PROVIDERS.map((p) => searchProviderStatus(p.service)));
}
