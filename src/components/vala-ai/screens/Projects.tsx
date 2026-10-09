import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderGit2, Plus } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { api, useAction, useApi, type Project, type Workspace } from "../api";
import { useCan } from "../session";
import { Badge, Card, Empty, ErrorBox, Field, inputClass, Loading, Page, PageHeader } from "../ui";
import { relativeTime } from "../format";

export function Projects() {
  const { translate: t } = useLanguage();
  const canEdit = useCan("operator");
  const projects = useApi<(Project & { open_tasks: number; approved_version: number | null })[]>(
    ["projects"],
    "/projects",
  );
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title={t("Projects & Requirements")}
        description={t(
          "Each project has a permanent ID and its own isolated workspace. The original source is only ever read.",
        )}
        icon={FolderGit2}
        actions={
          canEdit ? (
            <button
              onClick={() => setCreating((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg va-btn-primary px-3 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {t("New project")}
            </button>
          ) : null
        }
      />
      <Page>
        {creating ? <NewProject onDone={() => setCreating(false)} /> : null}
        <ErrorBox error={projects.error} />
        {projects.isPending ? (
          <Loading />
        ) : (projects.data ?? []).length === 0 ? (
          <Empty>{t("No projects yet.")}</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.data!.map((p) => (
              <Link
                key={p.id}
                to="/vala-ai/projects/$projectId"
                params={{ projectId: p.id }}
                className="block rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                  </div>
                  <Badge value={p.source_kind === "git" ? "git" : "empty"} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {p.description || t("No description.")}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    {p.approved_version
                      ? `${t("Requirement")} v${p.approved_version} ${t("approved")}`
                      : t("No approved requirement")}
                  </span>
                  <span>
                    {p.open_tasks} {t("open task(s)")}
                  </span>
                  <span>
                    {t("Updated")} {relativeTime(p.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Page>
    </div>
  );
}

function NewProject({ onDone }: { onDone: () => void }) {
  const { translate: t } = useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceKind, setSourceKind] = useState<"git" | "empty">("git");
  const [sourcePath, setSourcePath] = useState("");
  const create = useAction((body: object) =>
    api<{ project: Project; workspace: Workspace | null; workspaceError: string | null }>(
      "/projects",
      { method: "POST", body },
    ),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, description, sourceKind, sourcePath },
      {
        onSuccess: (r) => {
          onDone();
          void navigate({
            to: "/vala-ai/projects/$projectId",
            params: { projectId: r.project.id },
          });
        },
      },
    );
  };

  return (
    <Card title={t("New project")}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label={t("Name")}>
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("Starts from")}>
          <select
            value={sourceKind}
            onChange={(e) => setSourceKind(e.target.value as "git" | "empty")}
            className={inputClass}
          >
            <option value="git">
              {t("An existing local git repository (cloned, never modified)")}
            </option>
            <option value="empty">{t("An empty workspace")}</option>
          </select>
        </Field>
        {sourceKind === "git" ? (
          <Field
            label={t("Repository path on the server")}
            hint={t(
              "Absolute path. Vala AI clones it into its own workspace; the original is only read.",
            )}
          >
            <input
              required
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="C:\\path\\to\\repo  or  /srv/repos/app" // i18n-ignore: sample path
              className={inputClass}
            />
          </Field>
        ) : null}
        <Field label={t("Description")}>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2">
          <ErrorBox error={create.error} />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg va-btn-primary px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {create.isPending ? t("Creating workspace…") : t("Create project")}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            {t("Cancel")}
          </button>
        </div>
      </form>
    </Card>
  );
}
