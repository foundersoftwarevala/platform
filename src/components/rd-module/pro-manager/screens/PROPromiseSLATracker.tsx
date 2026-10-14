import { PMPromiseSLABoard } from "../PMPromiseSLABoard";
import { PMSection } from "../pm-ui";

export const PROPromiseSLATracker = () => (
  <PMSection
    title="Promise & SLA tracker"
    description="Every promise made to a premium account, with deadline tracking, extension recommendations and escalation."
  >
    <PMPromiseSLABoard />
  </PMSection>
);
