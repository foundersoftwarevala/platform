import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { api, useAction, useApi, type GatewayServices, type Settings, type Status } from "../api";
import { useCan } from "../session";
import { Badge, Card, ErrorBox, Field, inputClass, Loading, Page, PageHeader } from "../ui";
import { relativeTime } from "../format";

const FIELDS: { key: keyof Settings; label: string; hint: string }[] = [
  {
    key: "model_url",
    label: "Local model URL",
    hint: "llama.cpp server on this machine or a private network. External providers are refused.",
  },
  {
    key: "model_timeout_s",
    label: "Model timeout (s)",
    hint: "One model call may not take longer.",
  },
  { key: "model_max_tokens", label: "Model max output tokens", hint: "" },
  {
    key: "command_timeout_s",
    label: "Command timeout (s)",
    hint: "A check is killed, with its process tree, after this.",
  },
  {
    key: "max_output_kb",
    label: "Stored output per check (KB)",
    hint: "The last part of the output is kept.",
  },
  { key: "max_fix_loops", label: "Max fix attempts per task", hint: "Bounded retries." },
  {
    key: "max_task_write_kb",
    label: "Write budget per task (KB)",
    hint: "Total bytes the agent may write in one task.",
  },
  {
    key: "max_file_kb",
    label: "Max file size (KB)",
    hint: "Largest file the agent may read or write.",
  },
  {
    key: "min_free_disk_gb",
    label: "Free disk floor (GB)",
    hint: "Below it, workspaces are not created and tasks wait as BLOCKED.",
  },
  {
    key: "min_free_mem_mb",
    label: "Free memory floor (MB)",
    hint: "Below it, tasks wait as BLOCKED.",
  },
  {
    key: "chat_per_minute",
    label: "Chat messages per minute, per account",
    hint: "Each message runs the model. Over the limit the request is refused.",
  },
  {
    key: "tasks_per_minute",
    label: "New tasks per minute, per account",
    hint: "Over the limit the request is refused.",
  },
];

export function SettingsScreen() {
  const { translate: t } = useLanguage();
  const isOwner = useCan("owner");
  const status = useApi<Status>(["status"], "/status", { refetchInterval: 10_000 });
  const settings = useApi<Settings>(["settings"], "/settings");
  const people = useApi<{ id: string; email: string; role: string; last_seen_at: string }[]>(
    ["people"],
    "/people",
  );
  const [form, setForm] = useState<Record<string, string>>({});
  const [unchanged, setUnchanged] = useState(false);
  const save = useAction((patch: Record<string, unknown>) =>
    api<Settings>("/settings", { method: "PATCH", body: patch }),
  );

  useEffect(() => {
    if (settings.data)
      setForm(Object.fromEntries(Object.entries(settings.data).map(([k, v]) => [k, String(v)])));
  }, [settings.data]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Record<string, unknown> = {};
    for (const f of FIELDS)
      if (settings.data && form[f.key] !== String(settings.data[f.key]))
        patch[f.key] = f.key === "model_url" ? form[f.key] : Number(form[f.key]);
    setUnchanged(Object.keys(patch).length === 0);
    if (Object.keys(patch).length) save.mutate(patch);
  };

  const s = status.data;
  return (
    <div>
      <PageHeader
        title={t("Settings & System")}
        description={t(
          "Measured system status, the limits the agent enforces, and who has used Vala AI.",
        )}
        icon={SettingsIcon}
      />
      <Page>
        <ErrorBox error={status.error ?? settings.error} />
        {s ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t("System status")}>
              <dl className="grid grid-cols-[160px_minmax(0,1fr)] gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">{t("Local model")}</dt>
                <dd>
                  {s.model.online
                    ? `${t("online")} · ${s.model.model}`
                    : `${t("offline")} · ${s.model.error}`}
                </dd>
                <dt className="text-muted-foreground">{t("Model URL")}</dt>
                <dd className="break-all">{s.model.url}</dd>
                <dt className="text-muted-foreground">{t("Runner")}</dt>
                <dd>
                  {s.worker.running ? t("running") : t("stopped")} · {s.worker.owner} ·{" "}
                  {t("last tick")} {relativeTime(s.worker.lastTick)}
                </dd>
                <dt className="text-muted-foreground">{t("Database")}</dt>
                <dd>
                  SQLite · {t("schema")} v{s.schemaVersion} {/* i18n-ignore: product name */}
                </dd>
                <dt className="text-muted-foreground">{t("Data directory")}</dt>
                <dd className="break-all">{s.dataDir}</dd>
                <dt className="text-muted-foreground">{t("Disk")}</dt>
                <dd>
                  {s.resources.freeDiskGb} {t("GB free of")} {s.resources.totalDiskGb}
                </dd>
                <dt className="text-muted-foreground">{t("Memory")}</dt>
                <dd>
                  {s.resources.freeMemMb} {t("MB free of")} {s.resources.totalMemMb}
                </dd>
                <dt className="text-muted-foreground">{t("Checks run")}</dt>
                <dd>
                  {s.sandbox.mode === "docker" && s.sandbox.ready
                    ? `${t("in a container")} · ${s.sandbox.image}`
                    : s.sandbox.problem}
                </dd>
                <dt className="text-muted-foreground">{t("Audit chain")}</dt>
                <dd>
                  {s.audit.ok ? t("intact") : `${t("broken at")} #${s.audit.brokenAt}`} ·{" "}
                  {s.audit.entries}
                </dd>
              </dl>
              {s.resources.problems.map((p) => (
                <p key={p} className="mt-2 text-xs va-text-warning">
                  {p}
                </p>
              ))}
            </Card>
            <Card title={t("Capabilities")}>
              <ul className="space-y-1.5 text-xs">
                {s.capabilities.map((c) => (
                  <li key={c.area} className="flex flex-wrap items-center gap-2">
                    <Badge value={c.status} />
                    <span>{t(c.area)}</span>
                    {c.note ? <span className="text-muted-foreground">— {t(c.note)}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <Loading />
        )}

        {settings.data ? <ModelSourceCard current={settings.data} isOwner={isOwner} /> : null}

        <Card title={t("Limits")}>
          {!settings.data ? (
            <Loading />
          ) : (
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.key} label={t(f.label)} hint={f.hint ? t(f.hint) : undefined}>
                  <input
                    disabled={!isOwner}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className={inputClass}
                    inputMode={f.key === "model_url" ? "url" : "numeric"}
                  />
                </Field>
              ))}
              <div className="md:col-span-2">
                <ErrorBox error={save.error} />
                {unchanged ? (
                  <p className="text-xs text-muted-foreground">{t("No changes to save.")}</p>
                ) : save.isSuccess ? (
                  <p className="text-xs va-text-success">{t("Saved.")}</p>
                ) : null}
              </div>
              {isOwner ? (
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={save.isPending}
                    className="rounded-lg va-btn-primary px-3 py-2 text-sm font-medium"
                  >
                    {t("Save limits")}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground md:col-span-2">
                  {t("Only an owner can change limits.")}
                </p>
              )}
            </form>
          )}
        </Card>

        <Card title={t("People who have used Vala AI")}>
          <p className="mb-2 text-xs text-muted-foreground">
            {t(
              "Access comes from Control Panel roles: owner = boss_owner, boss, founder, super_admin; operator = admin, developer; viewer = other staff roles. Roles are managed in the Control Panel.",
            )}
          </p>
          <ErrorBox error={people.error} />
          <ul className="divide-y divide-border text-sm">
            {(people.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap gap-2 py-1.5">
                <span>{p.email}</span>
                <Badge value={p.role} />
                <span className="text-xs text-muted-foreground">
                  {relativeTime(p.last_seen_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Page>
    </div>
  );
}

/**
 * Which model the agent uses. AI API Manager keeps the providers, models and
 * keys; Vala AI only stores which of its services to use.
 */
function ModelSourceCard({ current, isOwner }: { current: Settings; isOwner: boolean }) {
  const { translate: t } = useLanguage();
  const [source, setSource] = useState(current.model_source);
  const [service, setService] = useState(current.gateway_service);
  const services = useApi<GatewayServices>(
    ["gateway-services"],
    isOwner && source === "ai-api-manager" ? "/gateway-services" : null,
  );
  const save = useAction((patch: Record<string, unknown>) =>
    api<Settings>("/settings", { method: "PATCH", body: patch }),
  );
  const changed = source !== current.model_source || service !== current.gateway_service;
  return (
    <Card title={t("Model source")}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("Source")}>
          <select
            id="model-source"
            disabled={!isOwner}
            value={source}
            onChange={(e) => setSource(e.target.value as Settings["model_source"])}
            className={inputClass}
          >
            <option value="local">{t("Local model on this server (llama.cpp)")}</option>
            <option value="ai-api-manager">{t("AI API Manager (for example OpenAI)")}</option>
          </select>
        </Field>
        {source === "ai-api-manager" ? (
          <Field
            label={t("AI API Manager service")}
            hint={t(
              "Providers, models and keys are managed in AI API Manager. Vala AI never stores a key.",
            )}
          >
            <select
              id="gateway-service"
              disabled={!isOwner || !services.data?.available}
              value={service}
              onChange={(e) => setService(e.target.value)}
              className={inputClass}
            >
              <option value="">{t("Any active chat service")}</option>
              {(services.data?.services ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.provider}
                  {s.model ? ` · ${s.model}` : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      {services.data && !services.data.available ? (
        <p className="mt-2 text-xs va-text-warning">
          {t("AI API Manager is not available")}: {services.data.error}
        </p>
      ) : null}
      <ErrorBox error={services.error ?? save.error} />
      {isOwner ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!changed || save.isPending}
            onClick={() => save.mutate({ model_source: source, gateway_service: service })}
            className="va-btn-primary rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {t("Save model source")}
          </button>
          {save.isSuccess && !changed ? (
            <span className="text-xs va-text-success">{t("Saved.")}</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Only an owner can change the model source.")}
        </p>
      )}
    </Card>
  );
}
