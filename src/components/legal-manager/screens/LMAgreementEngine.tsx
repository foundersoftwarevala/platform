import { Sparkles, CheckCircle, Lock } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMAgreementEngineProps {
  activeSubSection: string;
}

const LMAgreementEngine = ({ activeSubSection }: LMAgreementEngineProps) => (
  <CatalogueScreen
    title="Agreement Engine (AI)"
    description="AI-powered agreement generation, versioning and publishing"
    icon={Sparkles}
    category="agreement_engine"
    tableTitle="AI Agreement Generators"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Generator" },
      { key: "type", header: "Scope" },
      { key: "aiScore", header: "AI score", render: (r) => (r.aiScore ? `${r.aiScore}%` : "—") },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Publish", status: "active", action: "Agreement Generator Published", icon: CheckCircle, confirm: false },
      { label: "Pause", status: "paused", action: "Agreement Generator Paused", icon: Lock, confirm: true },
    ]}
  />
);

export default LMAgreementEngine;
