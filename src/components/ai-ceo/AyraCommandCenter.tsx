import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { loadAyraGrantAudit, loadAyraGrants, setAyraGrant } from "@/lib/ai-ceo/ceo.functions";
import {
  AYRA_PERMISSION_GROUPS,
  AYRA_ROLES,
  type AyraGrantPermission,
  type AyraGrantRole,
} from "@/lib/ai-ceo/ayra-grants";
import {
  loadAyraCredentialStatuses,
  revokeAyraCredential,
  saveAyraCredential,
} from "@/lib/ai-ceo/ayra-vault.functions";
import type { AyraExternalService } from "@/lib/ai-ceo/ayra-vault.functions";
import {
  forgetAyraFact,
  loadAyraMemoryFacts,
  rememberAyraFact,
} from "@/lib/ai-ceo/ayra-memory.functions";
import {
  loadAyraCompanyProfile,
  saveAyraCompanyProfile,
  issueAyraAutofillExtensionToken,
} from "@/lib/ai-ceo/ayra-autofill.functions";
import type { AyraCompanyProfile } from "@/lib/ai-ceo/ayra-autofill.server";
import {
  generateAyraPromptProposals,
  loadAyraPromptProposals,
  reviewAyraPromptProposal,
} from "@/lib/ai-ceo/ayra-improvement.functions";

const COMPANY_PROFILE_FIELDS: { key: keyof AyraCompanyProfile; label: string; type?: string }[] = [
  { key: "company_name", label: "Company name" },
  { key: "contact_name", label: "Contact name" },
  { key: "email", label: "Business email", type: "email" },
  { key: "phone", label: "Business phone", type: "tel" },
  { key: "address", label: "Street address" },
  { key: "address_line_2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "region", label: "State / region" },
  { key: "postal_code", label: "Postal code" },
  { key: "country", label: "Country" },
  { key: "website", label: "Website", type: "url" },
];
const ROLE_LABELS: Record<AyraGrantRole, string> = {
  SUPER_ADMIN: "Super Admin",
  FRANCHISE: "Franchise",
  AYRA_AGENT: "AYRA Agent",
};
const TABS = [
  ...Object.keys(AYRA_PERMISSION_GROUPS),
  "Connect Services",
  "Self Improvement",
  "Long-Term Memory",
  "Company Profile",
  "Audit Logs",
] as const;
type Tab = (typeof TABS)[number];
const EXTERNAL_SERVICES: { key: AyraExternalService; label: string; hint: string }[] = [
  { key: "google_cloud", label: "Google Cloud", hint: "OAuth access token" },
  { key: "cloudflare", label: "Cloudflare", hint: "API token" },
  { key: "github", label: "GitHub", hint: "Personal access token" },
  { key: "facebook", label: "Facebook", hint: "Graph API access token" },
  { key: "instagram", label: "Instagram", hint: "Graph API access token" },
  { key: "youtube", label: "YouTube", hint: "Google OAuth access token" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AyraCommandCenter({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fetchGrants = useServerFn(loadAyraGrants);
  const fetchAudit = useServerFn(loadAyraGrantAudit);
  const saveGrant = useServerFn(setAyraGrant);
  const fetchCredentialStatuses = useServerFn(loadAyraCredentialStatuses);
  const saveCredential = useServerFn(saveAyraCredential);
  const revokeCredential = useServerFn(revokeAyraCredential);
  const fetchProposals = useServerFn(loadAyraPromptProposals);
  const createProposals = useServerFn(generateAyraPromptProposals);
  const reviewProposal = useServerFn(reviewAyraPromptProposal);
  const fetchMemoryFacts = useServerFn(loadAyraMemoryFacts);
  const rememberMemoryFact = useServerFn(rememberAyraFact);
  const forgetMemoryFact = useServerFn(forgetAyraFact);
  const [credentialDrafts, setCredentialDrafts] = useState<
    Partial<Record<AyraExternalService, string>>
  >({});
  const [selectedRole, setSelectedRole] = useState<AyraGrantRole>("SUPER_ADMIN");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [companyDraft, setCompanyDraft] = useState<AyraCompanyProfile>({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    address_line_2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "",
    website: "",
  });
  const [selectedTab, setSelectedTab] = useState<Tab>("System Control");
  const [extensionToken, setExtensionToken] = useState<string | null>(null);
  const [extensionTokenExpiry, setExtensionTokenExpiry] = useState<string | null>(null);

  const grants = useQuery({
    queryKey: ["ayra", "grants"],
    queryFn: () => fetchGrants(),
    enabled: open,
    staleTime: 0,
  });
  const audit = useQuery({
    queryKey: ["ayra", "grant-audit"],
    queryFn: () => fetchAudit(),
    enabled: open && selectedTab === "Audit Logs",
    staleTime: 0,
  });
  const credentials = useQuery({
    queryKey: ["ayra", "external-credential-status"],
    queryFn: () => fetchCredentialStatuses(),
    enabled: open && selectedTab === "Connect Services",
    staleTime: 0,
  });
  const memoryFacts = useQuery({
    queryKey: ["ayra", "private-memory"],
    queryFn: () => fetchMemoryFacts(),
    enabled: open && selectedTab === "Long-Term Memory",
    staleTime: 0,
  });
  const companyProfile = useQuery({
    queryKey: ["ayra", "company-profile"],
    queryFn: () => loadAyraCompanyProfile(),
    enabled: open && selectedTab === "Company Profile",
    staleTime: 0,
  });
  const createExtensionToken = useMutation({
    mutationFn: () => issueAyraAutofillExtensionToken(),
    onSuccess: ({ token, expiresAt }) => {
      setExtensionToken(token);
      setExtensionTokenExpiry(expiresAt);
      toast.success("One-time extension token created. Copy it into the Chrome extension now.");
    },
    onError: (error: unknown) => toast.error("Could not connect the extension", {
      description: error instanceof Error ? error.message : "The VPS connection could not be created.",
    }),
  });
  const persistCompanyProfile = useMutation({
    mutationFn: (profile: AyraCompanyProfile) => saveAyraCompanyProfile({ data: profile }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ayra", "company-profile"] });
      toast.success("Company profile saved to VPS Postgres.");
    },
    onError: (error: unknown) =>
      toast.error("Could not save company details", {
        description: error instanceof Error ? error.message : "The VPS-backed profile update failed.",
      }),
  });
  useEffect(() => {
    if (companyProfile.data) setCompanyDraft(companyProfile.data.profile);
  }, [companyProfile.data]);
  const addMemoryFact = useMutation({
    mutationFn: (content: string) => rememberMemoryFact({ data: { content } }),
    onSuccess: async () => {
      setMemoryDraft("");
      await queryClient.invalidateQueries({ queryKey: ["ayra", "private-memory"] });
      toast.success("Private memory saved to VPS Postgres.");
    },
    onError: (error: unknown) =>
      toast.error("Could not save private memory", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      }),
  });
  const removeMemoryFact = useMutation({
    mutationFn: (id: string) => forgetMemoryFact({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ayra", "private-memory"] });
      toast.success("Private memory deleted.");
    },
    onError: (error: unknown) =>
      toast.error("Could not delete private memory", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      }),
  });
  const proposals = useQuery({
    queryKey: ["ayra", "improvement-proposals"],
    queryFn: () => fetchProposals(),
    enabled: open && selectedTab === "Self Improvement",
    staleTime: 0,
  });
  const generateProposals = useMutation({
    mutationFn: () => createProposals(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["ayra", "improvement-proposals"] });
      toast.success(
        `${result.created} prompt review proposal(s) created from ${result.candidates} verified low-success agent(s).`,
      );
    },
    onError: (error: unknown) =>
      toast.error("Could not generate improvement proposals", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      }),
  });
  const proposalReview = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "rejected" }) =>
      reviewProposal({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ayra", "improvement-proposals"] });
      toast.success("Proposal review saved. Prompt edits require this explicit approval.");
    },
    onError: (error: unknown) =>
      toast.error("Could not review the proposal", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      }),
  });
  const credentialChange = useMutation({
    mutationFn: (input: { serviceName: AyraExternalService; token?: string }) =>
      input.token
        ? saveCredential({ data: { serviceName: input.serviceName, token: input.token } })
        : revokeCredential({ data: { serviceName: input.serviceName } }),
    onSuccess: async (_result, input) => {
      if (input.token) {
        setCredentialDrafts((drafts) => ({ ...drafts, [input.serviceName]: "" }));
      }
      await queryClient.invalidateQueries({ queryKey: ["ayra", "external-credential-status"] });
      toast.success(
        input.token ? "Credential encrypted and stored on VPS." : "Credential removed from VPS.",
        {
          description: "Provider connectivity is not verified by storing a token.",
        },
      );
    },
    onError: (error: unknown) => {
      toast.error("Credential change failed", {
        description: error instanceof Error ? error.message : "The server refused the update.",
      });
    },
  });
  const update = useMutation({
    mutationFn: (input: {
      roleName: AyraGrantRole;
      permissionKey: AyraGrantPermission;
      isEnabled: boolean;
    }) => saveGrant({ data: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ayra", "grants"] }),
        queryClient.invalidateQueries({ queryKey: ["ayra", "grant-audit"] }),
      ]);
      toast.success("Permission saved to VPS Postgres.");
    },
    onError: (error: unknown) => {
      toast.error("Permission was not saved", {
        description: error instanceof Error ? error.message : "The server refused the update.",
      });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const permissionRows =
    selectedTab in AYRA_PERMISSION_GROUPS
      ? AYRA_PERMISSION_GROUPS[selectedTab as keyof typeof AYRA_PERMISSION_GROUPS]
      : [];
  const errorMessage =
    grants.error instanceof Error ? grants.error.message : "Could not load AYRA grants.";

  return (
    <div
      className="aw-command-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside
        className="aw-command-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayra-command-title"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2
            id="ayra-command-title"
            className="aw-display text-lg tracking-widest text-[color:var(--aw-cyan)]"
          >
            AYRA COMMAND CENTER
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full border border-[color:var(--aw-line)] p-2 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-sm text-[color:var(--aw-soft)]">
          Only Control Panel-authorized Boss, Admin, or Super Admin users can manage these
          VPS-backed grants. There is no shared default PIN.
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold tracking-widest text-[color:var(--aw-cyan)]">
            ROLES &amp; PERMISSIONS
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Grant role">
            {AYRA_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                role="tab"
                aria-selected={selectedRole === role}
                onClick={() => setSelectedRole(role)}
                className={`rounded-md border px-3 py-2 text-sm ${selectedRole === role ? "aw-tab-on border-[color:var(--aw-cyan)]" : "border-[color:var(--aw-line)]"}`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mb-4 flex flex-wrap gap-1 border-b border-[color:var(--aw-line)] pb-2"
          role="tablist"
          aria-label="Permission settings"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selectedTab === tab}
              onClick={() => setSelectedTab(tab)}
              className={`rounded-md px-2 py-2 text-xs ${selectedTab === tab ? "aw-tab-on" : "text-[color:var(--aw-soft)]"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {grants.isLoading ? (
          <p role="status" className="text-sm text-[color:var(--aw-soft)]">
            Loading grants from VPS Postgres…
          </p>
        ) : grants.isError ? (
          <div role="alert" className="space-y-3 text-sm text-destructive">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => void grants.refetch()}
              className="rounded border border-current px-3 py-2"
            >
              Try again
            </button>
          </div>
        ) : selectedTab === "Connect Services" ? (
          credentials.isLoading ? (
            <p role="status" className="text-sm text-[color:var(--aw-soft)]">
              Loading encrypted credential statuses from VPS Postgres…
            </p>
          ) : credentials.isError ? (
            <div role="alert" className="space-y-3 text-sm text-destructive">
              <p>
                {credentials.error instanceof Error
                  ? credentials.error.message
                  : "Could not load credential statuses."}
              </p>
              <button
                type="button"
                onClick={() => void credentials.refetch()}
                className="rounded border border-current px-3 py-2"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-3" aria-label="Connect external services">
              <p className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-xs text-[color:var(--aw-soft)]">
                Tokens are encrypted before saving to VPS Postgres and are never read back into the
                browser. “Stored” confirms encryption and persistence only; it does not verify
                provider access. Supabase credentials are intentionally excluded from this VPS-only
                panel.
              </p>
              {EXTERNAL_SERVICES.map(({ key, label, hint }) => {
                const status = credentials.data?.find((row) => row.serviceName === key);
                return (
                  <form
                    key={key}
                    className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.03] p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const token = credentialDrafts[key]?.trim();
                      if (token) credentialChange.mutate({ serviceName: key, token });
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm">{label}</strong>
                      <span
                        className={`text-xs ${status?.configured ? "text-emerald-400" : "text-rose-400"}`}
                        role="status"
                      >
                        {status?.configured
                          ? "Encrypted credential stored · unverified"
                          : "Not configured"}
                      </span>
                    </div>
                    <label
                      className="mt-3 block text-xs text-[color:var(--aw-soft)]"
                      htmlFor={`ayra-credential-${key}`}
                    >
                      {hint}
                    </label>
                    <input
                      id={`ayra-credential-${key}`}
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      value={credentialDrafts[key] ?? ""}
                      onChange={(event) =>
                        setCredentialDrafts((drafts) => ({ ...drafts, [key]: event.target.value }))
                      }
                      placeholder={
                        status?.configured
                          ? "Enter a replacement token"
                          : "Paste token; it will not be displayed again"
                      }
                      className="mt-1 w-full rounded-md border border-[color:var(--aw-line)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[color:var(--aw-cyan)]"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      {status?.configured && (
                        <button
                          type="button"
                          disabled={credentialChange.isPending}
                          onClick={() => credentialChange.mutate({ serviceName: key })}
                          className="rounded-md border border-[color:var(--aw-line)] px-3 py-2 text-xs disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={credentialChange.isPending || !credentialDrafts[key]?.trim()}
                        className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-xs text-[color:var(--aw-cyan)] disabled:opacity-50"
                      >
                        Save encrypted token
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          )
        ) : selectedTab === "Company Profile" ? (
          companyProfile.isLoading ? (
            <p role="status" className="text-sm text-[color:var(--aw-soft)]">
              Loading company details from VPS Postgres…
            </p>
          ) : companyProfile.isError ? (
            <div role="alert" className="space-y-3 text-sm text-destructive">
              <p>
                {companyProfile.error instanceof Error
                  ? companyProfile.error.message
                  : "Could not load the company profile."}
              </p>
              <button
                type="button"
                onClick={() => void companyProfile.refetch()}
                className="rounded border border-current px-3 py-2"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
            <form
              className="space-y-3"
              aria-label="Software Vala company profile"
              onSubmit={(event) => {
                event.preventDefault();
                persistCompanyProfile.mutate(companyDraft);
              }}
            >
              <p className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-xs text-[color:var(--aw-soft)]">
                These verified company details are stored on VPS Postgres. The Chrome extension sends matched values only after you click Fill on the active page. AYRA never submits the form.
              </p>
              {!companyProfile.data?.configured && (
                <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">
                  No company profile is saved yet. Add and save the details you want AYRA to use.
                </p>
              )}
              {COMPANY_PROFILE_FIELDS.map(({ key, label, type }) => (
                <label key={key} className="block text-xs text-[color:var(--aw-soft)]">
                  {label}{key === "company_name" ? " *" : ""}
                  <input
                    type={type ?? "text"}
                    required={key === "company_name"}
                    maxLength={
                      key === "company_name" || key === "contact_name"
                        ? 200
                        : key === "email"
                          ? 320
                          : key === "phone"
                            ? 80
                            : key === "address"
                              ? 300
                              : key === "address_line_2"
                                ? 200
                                : key === "city" || key === "region" || key === "country"
                                  ? 120
                                  : key === "postal_code"
                                    ? 40
                                    : 500
                    }
                    value={companyDraft[key]}
                    onChange={(event) =>
                      setCompanyDraft((draft) => ({ ...draft, [key]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-[color:var(--aw-line)] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[color:var(--aw-cyan)]"
                  />
                </label>
              ))}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!companyDraft.company_name.trim() || persistCompanyProfile.isPending}
                  className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-sm text-[color:var(--aw-cyan)] disabled:opacity-50"
                >
                  {persistCompanyProfile.isPending ? "Saving…" : "Save company profile"}
                </button>
              </div>
            </form>
            <section className="mt-5 space-y-3 rounded-lg border border-[color:var(--aw-line)] bg-white/[0.03] p-4" aria-label="Chrome extension connection">
              <div>
                <h3 className="text-sm font-semibold text-white">Universal Auto-Fill Chrome extension</h3>
                <p className="mt-1 text-xs text-[color:var(--aw-soft)]">Download the extension, load it unpacked in Chrome, then create a 24-hour connection token and paste it into the extension popup. Creating a new token revokes the previous one.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/downloads/ayra-extension.zip" download className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-sm text-[color:var(--aw-cyan)]">Download extension (.zip)</a>
                <button type="button" disabled={!companyProfile.data?.configured || createExtensionToken.isPending} onClick={() => createExtensionToken.mutate()} className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-sm text-[color:var(--aw-cyan)] disabled:opacity-50">{createExtensionToken.isPending ? "Creating…" : "Generate 24-hour connection token"}</button>
              </div>
              {extensionToken && (
                <div className="space-y-2" role="status">
                  <label className="block text-xs text-[color:var(--aw-soft)]">Copy this token into the extension popup. It is shown once and expires {extensionTokenExpiry ? new Date(extensionTokenExpiry).toLocaleString() : "in 24 hours"}.
                    <textarea readOnly value={extensionToken} rows={3} className="mt-1 w-full select-all rounded-md border border-[color:var(--aw-line)] bg-black/30 p-2 font-mono text-xs text-white" onFocus={(event) => event.currentTarget.select()} />
                  </label>
                  <button type="button" onClick={() => { void navigator.clipboard.writeText(extensionToken).then(() => toast.success("Extension token copied."), () => toast.error("Copy failed; select and copy the token manually.")); }} className="rounded-md border border-[color:var(--aw-line)] px-3 py-2 text-xs text-white">Copy token</button>
                </div>
              )}
              <p className="text-xs text-[color:var(--aw-soft)]">The extension reads field labels and fills supported empty inputs on the active tab only. Review values before submitting. It skips sensitive fields and never submits forms.</p>
            </section>
            </>
          )
        ) : selectedTab === "Self Improvement" ? (
          <div className="space-y-3" aria-label="AYRA self-improvement proposals">
            <p className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-xs text-[color:var(--aw-soft)]">
              Proposals use verified runs only and need an executive review before an agent prompt
              changes. Code fixes are never pushed automatically. The live success_rate field is
              currently zero for all agents, so candidates are derived from verified outcomes and
              require at least five recorded results.
            </p>
            <button
              type="button"
              disabled={generateProposals.isPending}
              onClick={() => generateProposals.mutate()}
              className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-sm text-[color:var(--aw-cyan)] disabled:opacity-50"
            >
              {generateProposals.isPending
                ? "Reviewing verified runs…"
                : "Generate prompt proposals"}
            </button>
            {proposals.isLoading ? (
              <p role="status" className="text-sm text-[color:var(--aw-soft)]">
                Loading proposal queue…
              </p>
            ) : proposals.isError ? (
              <div role="alert" className="space-y-3 text-sm text-destructive">
                <p>
                  {proposals.error instanceof Error
                    ? proposals.error.message
                    : "Could not load improvement proposals."}
                </p>
                <button
                  type="button"
                  onClick={() => void proposals.refetch()}
                  className="rounded border border-current px-3 py-2"
                >
                  Try again
                </button>
              </div>
            ) : proposals.data?.length ? (
              <div className="space-y-3">
                {proposals.data.map((proposal) => (
                  <article
                    key={proposal.id}
                    className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm">{proposal.agentName}</strong>
                      <span className="text-xs text-[color:var(--aw-soft)]">
                        {proposal.status.replaceAll("_", " ")} · verified success{" "}
                        {proposal.successRateSnapshot?.toFixed(1) ?? "—"}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{proposal.reason}</p>
                    {proposal.proposedPrompt && (
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-xs">
                        {proposal.proposedPrompt}
                      </pre>
                    )}
                    {proposal.status === "pending_review" && (
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={proposalReview.isPending}
                          onClick={() =>
                            proposalReview.mutate({ id: proposal.id, decision: "rejected" })
                          }
                          className="rounded-md border border-[color:var(--aw-line)] px-3 py-2 text-xs disabled:opacity-50"
                        >
                          Reject
                        </button>
                        {proposal.proposalKind === "prompt" && (
                          <button
                            type="button"
                            disabled={proposalReview.isPending}
                            onClick={() =>
                              proposalReview.mutate({ id: proposal.id, decision: "approved" })
                            }
                            className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-xs text-[color:var(--aw-cyan)] disabled:opacity-50"
                          >
                            Approve prompt update
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--aw-soft)]">
                No eligible verified low-success agents or pending proposals.
              </p>
            )}
          </div>
        ) : selectedTab === "Long-Term Memory" ? (
          <div className="space-y-3" aria-label="AYRA private long-term memory">
            <p className="rounded-md border border-[color:var(--aw-line)] bg-white/[0.04] p-3 text-xs text-[color:var(--aw-soft)]">
              Facts are private to your signed-in account and stored only in VPS Postgres. Semantic
              recall uses an installed local Ollama embedding model with exactly 1536 dimensions;
              external embedding providers are never used.
            </p>
            <form
              className="space-y-2 rounded-md border border-[color:var(--aw-line)] bg-white/[0.03] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const content = memoryDraft.trim();
                if (content) addMemoryFact.mutate(content);
              }}
            >
              <label
                htmlFor="ayra-memory-fact"
                className="block text-xs text-[color:var(--aw-soft)]"
              >
                Remember a private fact
              </label>
              <textarea
                id="ayra-memory-fact"
                maxLength={2000}
                value={memoryDraft}
                onChange={(event) => setMemoryDraft(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-[color:var(--aw-line)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[color:var(--aw-cyan)]"
                placeholder="For example: Our preferred delivery window is 9 AM–5 PM IST."
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!memoryDraft.trim() || addMemoryFact.isPending}
                  className="rounded-md border border-[color:var(--aw-cyan)] px-3 py-2 text-xs text-[color:var(--aw-cyan)] disabled:opacity-50"
                >
                  {addMemoryFact.isPending ? "Saving…" : "Save private fact"}
                </button>
              </div>
            </form>
            {memoryFacts.isLoading ? (
              <p role="status" className="text-sm text-[color:var(--aw-soft)]">
                Loading private memory from VPS Postgres…
              </p>
            ) : memoryFacts.isError ? (
              <div role="alert" className="space-y-3 text-sm text-destructive">
                <p>
                  {memoryFacts.error instanceof Error
                    ? memoryFacts.error.message
                    : "Could not load private memory."}
                </p>
                <button
                  type="button"
                  onClick={() => void memoryFacts.refetch()}
                  className="rounded border border-current px-3 py-2"
                >
                  Try again
                </button>
              </div>
            ) : memoryFacts.data?.length ? (
              <ul className="space-y-2">
                {memoryFacts.data.map((fact) => (
                  <li
                    key={fact.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-[color:var(--aw-line)] bg-white/[0.03] p-3"
                  >
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-sm">{fact.content}</p>
                      <time
                        className="mt-1 block text-xs text-[color:var(--aw-soft)]"
                        dateTime={fact.createdAt}
                      >
                        {new Date(fact.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <button
                      type="button"
                      disabled={removeMemoryFact.isPending}
                      onClick={() => removeMemoryFact.mutate(fact.id)}
                      className="shrink-0 rounded border border-[color:var(--aw-line)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--aw-soft)]">
                No private facts saved yet. You can also tell AYRA “Remember: …” during a chat.
              </p>
            )}
          </div>
        ) : selectedTab === "Audit Logs" ? (
          audit.isLoading ? (
            <p role="status" className="text-sm text-[color:var(--aw-soft)]">
              Loading grant audit history…
            </p>
          ) : audit.isError ? (
            <div role="alert" className="space-y-3 text-sm text-destructive">
              <p>
                {audit.error instanceof Error
                  ? audit.error.message
                  : "Could not load the grant audit history."}
              </p>
              <button
                type="button"
                onClick={() => void audit.refetch()}
                className="rounded border border-current px-3 py-2"
              >
                Try again
              </button>
            </div>
          ) : audit.data?.length ? (
            <div className="space-y-2" aria-label="AYRA grant audit history">
              {audit.data.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-[color:var(--aw-line)] p-3 text-sm"
                >
                  <div className="font-medium">{entry.action.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-xs text-[color:var(--aw-soft)]">
                    {entry.actor} · {entry.entityId ?? "grant"} · {entry.occurredAt}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[color:var(--aw-soft)]">
              No AYRA grant changes have been recorded.
            </p>
          )
        ) : permissionRows.length === 0 ? (
          <p className="text-sm text-[color:var(--aw-soft)]">
            No permissions are configured for this section.
          </p>
        ) : (
          <div className="space-y-2" aria-label={`${ROLE_LABELS[selectedRole]} grants`}>
            {permissionRows.map(([permissionKey, label]) => {
              const grant = grants.data?.find(
                (row) => row.roleName === selectedRole && row.permissionKey === permissionKey,
              );
              return (
                <div
                  key={permissionKey}
                  className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--aw-line)] bg-white/[0.03] p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-1 font-mono text-[10px] text-[color:var(--aw-muted)]">
                      {permissionKey}
                    </div>
                  </div>
                  {grant ? (
                    <Switch
                      aria-label={label}
                      checked={grant.isEnabled}
                      disabled={update.isPending}
                      onCheckedChange={(isEnabled) =>
                        update.mutate({ roleName: selectedRole, permissionKey, isEnabled })
                      }
                    />
                  ) : (
                    <span className="text-xs text-[color:var(--aw-muted)]">Not configured</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
