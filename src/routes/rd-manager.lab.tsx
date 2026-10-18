import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/rd-module/ui/sonner";
import { RnDMobileNav, RnDSidebar, type RnDSectionId } from "@/components/rd-module/rnd/RnDSidebar";
import { RnDTopBar } from "@/components/rd-module/rnd/RnDTopBar";
import { FutureLab } from "@/components/rd-module/rnd/FutureLab";
import { AIRnDAssistant } from "@/components/rd-module/rnd/AIRnDAssistant";
import { AIIdeaScorer } from "@/components/rd-module/rnd/AIIdeaScorer";
import { TechnologyRadar } from "@/components/rd-module/rnd/TechnologyRadar";
import { InnovationPipeline } from "@/components/rd-module/rnd/InnovationPipeline";
import { PrototypeBuilder } from "@/components/rd-module/rnd/PrototypeBuilder";
import { ImpactAnalyzer } from "@/components/rd-module/rnd/ImpactAnalyzer";
import { TrendScanner } from "@/components/rd-module/rnd/TrendScanner";
import { FeedbackPortal } from "@/components/rd-module/rnd/FeedbackPortal";
import { DecisionBoard } from "@/components/rd-module/rnd/DecisionBoard";
import { RnDWallet } from "@/components/rd-module/rnd/RnDWallet";
import { RnDNotifications } from "@/components/rd-module/rnd/RnDNotifications";
import {
  useDecisions,
  useIdeas,
  useNotifications,
  usePrototypes,
  useTrends,
} from "@/hooks/rd-module/useRnDData";

export const Route = createFileRoute("/rd-manager/lab")({
  head: () => ({
    meta: [
      { title: "R&D Dashboard — Software Vala" },
      {
        name: "description",
        content:
          "Software Vala R&D command center: idea intake, AI evaluation, prototypes, trends, decisions and research budget in one workspace.",
      },
      { property: "og:title", content: "R&D Dashboard — Software Vala" },
      {
        property: "og:description",
        content:
          "Innovation pipeline, AI research assistant and live R&D analytics for Software Vala.",
      },
    ],
  }),
  component: RnDDashboard,
});

function RnDDashboard() {
  const [activeTab, setActiveTab] = useState<RnDSectionId>("future-lab");
  const [search, setSearch] = useState("");

  const { data: ideas } = useIdeas();
  const { data: prototypes } = usePrototypes();
  const { data: trends } = useTrends();
  const { data: decisions } = useDecisions();
  const { data: notifications } = useNotifications();

  const unread = (notifications ?? []).filter((item) => !item.read).length;

  return (
    <div className="flex min-h-dvh">
      <RnDSidebar activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RnDTopBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          search={search}
          onSearchChange={setSearch}
          mobileNav={
            <RnDMobileNav activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unread} />
          }
          stats={{
            ideas: ideas?.length ?? 0,
            prototypes: prototypes?.length ?? 0,
            trends: trends?.length ?? 0,
            decisions: decisions?.length ?? 0,
          }}
        />
        <main className="flex-1 p-4 sm:p-6">
          <h1 className="sr-only">Software Vala R&amp;D Dashboard</h1>
          {activeTab === "future-lab" && <FutureLab search={search} />}
          {activeTab === "ai-assistant" && <AIRnDAssistant />}
          {activeTab === "idea-scorer" && <AIIdeaScorer />}
          {activeTab === "tech-radar" && <TechnologyRadar />}
          {activeTab === "pipeline" && <InnovationPipeline />}
          {activeTab === "prototype" && <PrototypeBuilder />}
          {activeTab === "impact" && <ImpactAnalyzer />}
          {activeTab === "trends" && <TrendScanner />}
          {activeTab === "feedback" && <FeedbackPortal />}
          {activeTab === "decisions" && <DecisionBoard />}
          {activeTab === "wallet" && <RnDWallet />}
          {activeTab === "notifications" && <RnDNotifications />}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
