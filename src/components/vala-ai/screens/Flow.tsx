import { useState } from "react";
import { GitBranch, ChevronDown, ChevronRight, AlertCircle, Plus, Send, Package } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { api, useAction, useApi, type ProjectFlow, type Issue, type Version } from "../api";
import { Badge, Card, Empty, ErrorBox, Loading, Page, PageHeader, Field, inputClass } from "../ui";
import { relativeTime } from "../format";
import { FLOW_STEPS } from "../../lib/vala-ai/flow.server";

export function Flow() {
  const { translate: t } = useLanguage();
  const flow = useApi<ProjectFlow[]>(["flow"], "/flow", { refetchInterval: 5000 });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div>
      <PageHeader
        title={t("Client Flow Tracker")}
        description={t("Track project progress through the 30-step client workflow.")}
        icon={GitBranch}
      />
      <Page>
        <ErrorBox error={flow.error} />
        {flow.isPending ? (
          <Loading />
        ) : flow.data?.length === 0 ? (
          <Empty>{t("No projects in flow yet.")}</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("Project")}</th>
                  <th className="px-4 py-3">{t("Code")}</th>
                  <th className="px-4 py-3">{t("Current Step")}</th>
                  <th className="px-4 py-3">{t("Status")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flow.data!.map((p) => (
                  <ProjectRow 
                    key={p.id} 
                    p={p} 
                    isExpanded={!!expanded[p.id]} 
                    onToggle={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))} 
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Page>
    </div>
  );
}

function ProjectRow({ p, isExpanded, onToggle }: { p: ProjectFlow, isExpanded: boolean, onToggle: () => void }) {
  const { translate: t } = useLanguage();
  const advance = useAction((step: number) => api(`/projects/${p.id}/flow/advance`, { method: "POST", body: { step } }));
  
  return (
    <>
      <tr className="group hover:bg-muted/30">
        <td className="px-4 py-4">
          <button onClick={onToggle} className="flex items-center gap-2 font-medium">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {p.name}
          </button>
        </td>
        <td className="px-4 py-4 font-mono text-xs">{p.project_code}</td>
        <td className="px-4 py-4">
          <span className="font-semibold">{p.current_step}</span>/30
          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${(p.current_step / 30) * 100}%` }}
            />
          </div>
        </td>
        <td className="px-4 py-4">
          <Badge value={p.current_step === 30 ? "COMPLETE" : "active"} />
        </td>
        <td className="px-4 py-4 text-right">
           <button 
             onClick={() => advance.mutate(p.current_step + 1)}
             disabled={p.current_step >= 30 || advance.isPending}
             className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
           >
             {t("Next Step")}
           </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-muted/20 px-4 py-4">
            <ProjectFlowDetails p={p} />
          </td>
        </tr>
      )}
    </>
  );
}

function ProjectFlowDetails({ p }: { p: ProjectFlow }) {
  const { translate: t } = useLanguage();
  const issues = useApi<Issue[]>(["issues", p.id], `/projects/${p.id}/issues`);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showVersionForm, setShowVersionForm] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Workflow Steps")}</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {FLOW_STEPS.map((stepName, i) => {
            const stepNum = i + 1;
            const data = p.steps[stepNum];
            return (
              <div key={stepNum} className={`flex items-center gap-3 rounded-lg border p-2 text-xs ${stepNum === p.current_step ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${data ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                  {stepNum}
                </span>
                <div className="flex-1">
                  <p className="font-medium capitalize">{stepName}</p>
                  {data && <p className="text-[10px] text-muted-foreground">{relativeTime(data.at)}</p>}
                </div>
                {data && <Badge value="completed" className="bg-success/10 text-success border-success/20" />}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Issues")}</h3>
            <button onClick={() => setShowIssueForm(true)} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Plus className="h-3 w-3" /> {t("Report Issue")}
            </button>
          </div>
          <ErrorBox error={issues.error} />
          {issues.data?.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {t("No issues reported.")}
            </div>
          ) : (
            <div className="space-y-2">
              {issues.data?.map(issue => (
                <div key={issue.id} className="rounded-lg border bg-surface p-2 text-xs">
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{issue.issue_code}</span>
                    <Badge value={issue.status} />
                  </div>
                  <p className="mt-1">{issue.text}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{relativeTime(issue.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
           <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Versions & Delivery")}</h3>
            <button onClick={() => setShowVersionForm(true)} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Package className="h-3 w-3" /> {t("Create Version")}
            </button>
          </div>
          <VersionsList projectId={p.id} />
        </div>
      </div>
      
      {showIssueForm && <IssueForm projectId={p.id} onClose={() => setShowIssueForm(false)} />}
      {showVersionForm && <VersionForm projectId={p.id} onClose={() => setShowVersionForm(false)} />}
    </div>
  );
}

function VersionsList({ projectId }: { projectId: string }) {
  const { translate: t } = useLanguage();
  const detail = useApi<any>(["project", projectId], `/projects/${projectId}`);
  const versions = useApi<Version[]>(["versions", projectId], `/projects/${projectId}/versions`, { enabled: false }); // Need an endpoint for this or use releases
  // Actually, I defined versions table but maybe I should just use the releases if they are the same.
  // But the prompt asked for a new versions table.
  // I need an endpoint for GET /projects/:id/versions. I forgot to add it to api.server.ts.
  
  // For now let us assume we have one or use the releases.
  const deliver = useAction((id: string) => api(`/versions/${id}/deliver`, { method: "POST" }));

  // I will add the missing endpoint to api.server.ts in a bit.
  const projectVersions = useApi<Version[]>(["project-versions", projectId], `/projects/${projectId}/versions`);

  return (
    <div className="space-y-2">
      <ErrorBox error={projectVersions.error || deliver.error} />
      {projectVersions.data?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          {t("No versions created.")}
        </div>
      ) : (
        projectVersions.data?.map(v => (
          <div key={v.id} className="rounded-lg border bg-surface p-2 text-xs">
             <div className="flex items-start justify-between">
               <span className="font-mono text-[10px] font-bold text-muted-foreground">{v.version_code}</span>
               <div className="flex gap-2">
                 <Badge value={v.test_status} />
                 <Badge value={v.delivery_status} />
               </div>
             </div>
             <p className="mt-1 line-clamp-2 text-muted-foreground">{v.change_history}</p>
             <button 
               onClick={() => deliver.mutate(v.id)}
               disabled={v.test_status !== "passed" || v.delivery_status === "delivered" || deliver.isPending}
               className="mt-2 w-full rounded-lg bg-primary px-2 py-1 text-[10px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
             >
               {v.delivery_status === "delivered" ? t("Delivered") : t("Deliver to Client")}
             </button>
          </div>
        ))
      )}
    </div>
  );
}

function IssueForm({ projectId, onClose }: { projectId: string, onClose: () => void }) {
  const { translate: t } = useLanguage();
  const [kind, setKind] = useState("bug");
  const [text, setText] = useState("");
  const report = useAction((body: any) => api(`/projects/${projectId}/issues`, { method: "POST", body }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    report.mutate({ kind, text }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card title={t("Report Issue")} className="w-full max-w-md bg-background">
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("Kind")}>
             <select value={kind} onChange={e => setKind(e.target.value)} className={inputClass}>
               <option value="bug">{t("Bug")}</option>
               <option value="feature">{t("Feature Request")}</option>
               <option value="security">{t("Security")}</option>
               <option value="other">{t("Other")}</option>
             </select>
          </Field>
          <Field label={t("Description")}>
            <textarea 
              required 
              rows={4} 
              value={text} 
              onChange={e => setText(e.target.value)} 
              className={inputClass} 
              placeholder={t("Describe the issue...")}
            />
          </Field>
          <ErrorBox error={report.error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">{t("Cancel")}</button>
            <button type="submit" disabled={report.isPending} className="rounded-lg va-btn-primary px-3 py-2 text-sm">{t("Submit")}</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function VersionForm({ projectId, onClose }: { projectId: string, onClose: () => void }) {
  const { translate: t } = useLanguage();
  const [changeHistory, setChangeHistory] = useState("");
  const create = useAction((body: any) => api(`/projects/${projectId}/versions`, { method: "POST", body }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ changeHistory }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card title={t("Create New Version")} className="w-full max-w-md bg-background">
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("Change History")}>
            <textarea 
              required 
              rows={4} 
              value={changeHistory} 
              onChange={e => setChangeHistory(e.target.value)} 
              className={inputClass} 
              placeholder={t("What has changed in this version...")}
            />
          </Field>
          <ErrorBox error={create.error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">{t("Cancel")}</button>
            <button type="submit" disabled={create.isPending} className="rounded-lg va-btn-primary px-3 py-2 text-sm">{t("Create")}</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
