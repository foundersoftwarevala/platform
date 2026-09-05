import { useState } from "react";
import { Brain } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useManyRecords } from "@/lib/manager-queries";
import { ErrorState, LoadingBlock, PageHeader } from "@/components/manager/primitives";

import { RegistryPanel } from "./governance/RegistryPanel";
import { AgentsPanel } from "./governance/AgentsPanel";
import { PromptsPanel } from "./governance/PromptsPanel";
import { FineTunePanel } from "./governance/FineTunePanel";
import { EvalPanel } from "./governance/EvalPanel";
import { SafetyPanel } from "./governance/SafetyPanel";
import { DataGovernancePanel } from "./governance/DataGovernancePanel";
import { OnDevicePanel } from "./governance/OnDevicePanel";
import { LifecyclePanel } from "./governance/LifecyclePanel";
import { IncidentsPanel } from "./governance/IncidentsPanel";

const SUBSECTIONS = [
  "gov-registry",
  "gov-agents",
  "gov-prompts",
  "gov-finetune",
  "gov-eval",
  "gov-safety",
  "gov-data",
  "gov-ondevice",
  "gov-lifecycle",
  "gov-incidents",
];

export default function GovernanceScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "gov-registry";
  const [activeTab, setActiveTab] = useState(tab);

  const many = useManyRecords([
    { table: "ai_models", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "ai_providers", orderBy: "name", ascending: true, limit: 200 },
    { table: "ai_agents", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "prompts", orderBy: "updated_at", ascending: false, limit: 200 },
    { table: "prompt_versions", orderBy: "created_at", ascending: false, limit: 500 },
    { table: "fine_tuning_jobs", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "model_evaluations", orderBy: "evaluated_at", ascending: false, limit: 300 },
    { table: "safety_policies", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "data_governance_rules", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "on_device_models", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "model_versions", orderBy: "released_at", ascending: false, limit: 300 },
    { table: "incidents", orderBy: "started_at", ascending: false, limit: 200 },
    { table: "security_alerts", orderBy: "detected_at", ascending: false, limit: 200 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 200 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Governance" description="Model registry, agents, prompts, safety and lifecycle controls" />
        <LoadingBlock rows={8} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Governance" description="Model registry, agents, prompts, safety and lifecycle controls" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [
    models,
    providers,
    agents,
    prompts,
    promptVersions,
    fineTuningJobs,
    modelEvaluations,
    safetyPolicies,
    dataGovernanceRules,
    onDeviceModels,
    modelVersions,
    incidents,
    securityAlerts,
    services,
  ] = many.data ?? [[], [], [], [], [], [], [], [], [], [], [], [], [], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Governance"
        description="Model registry, agents, prompts, fine-tuning, safety, data governance and lifecycle controls"
        actions={<Brain className="h-6 w-6 text-primary" />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="gov-registry">Model Registry</TabsTrigger>
          <TabsTrigger value="gov-agents">Models & Agents</TabsTrigger>
          <TabsTrigger value="gov-prompts">Prompts</TabsTrigger>
          <TabsTrigger value="gov-finetune">Fine-Tuning</TabsTrigger>
          <TabsTrigger value="gov-eval">Evaluation</TabsTrigger>
          <TabsTrigger value="gov-safety">Safety</TabsTrigger>
          <TabsTrigger value="gov-data">Data Governance</TabsTrigger>
          <TabsTrigger value="gov-ondevice">On-Device AI</TabsTrigger>
          <TabsTrigger value="gov-lifecycle">Version Lifecycle</TabsTrigger>
          <TabsTrigger value="gov-incidents">Incidents & Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="gov-registry">
          <RegistryPanel models={models ?? []} providers={providers ?? []} />
        </TabsContent>

        <TabsContent value="gov-agents">
          <AgentsPanel agents={agents ?? []} models={models ?? []} />
        </TabsContent>

        <TabsContent value="gov-prompts">
          <PromptsPanel prompts={prompts ?? []} versions={promptVersions ?? []} />
        </TabsContent>

        <TabsContent value="gov-finetune">
          <FineTunePanel jobs={fineTuningJobs ?? []} />
        </TabsContent>

        <TabsContent value="gov-eval">
          <EvalPanel evaluations={modelEvaluations ?? []} models={models ?? []} />
        </TabsContent>

        <TabsContent value="gov-safety">
          <SafetyPanel policies={safetyPolicies ?? []} />
        </TabsContent>

        <TabsContent value="gov-data">
          <DataGovernancePanel rules={dataGovernanceRules ?? []} />
        </TabsContent>

        <TabsContent value="gov-ondevice">
          <OnDevicePanel models={onDeviceModels ?? []} />
        </TabsContent>

        <TabsContent value="gov-lifecycle">
          <LifecyclePanel versions={modelVersions ?? []} models={models ?? []} />
        </TabsContent>

        <TabsContent value="gov-incidents">
          <IncidentsPanel incidents={incidents ?? []} alerts={securityAlerts ?? []} services={services ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
