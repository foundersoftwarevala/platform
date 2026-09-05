/**
 * DEMO MANAGER LAYOUT
 * ===================
 * Views are driven by the global sidebar via the `?view=` search param.
 */

import { useRouterState } from "@tanstack/react-router";
import DemoManagerMainContent from "./DemoManagerMainContent";

const DemoManagerFullLayout = () => {
  const search = useRouterState({ select: (s) => s.location.search }) as { view?: string };
  const activeView = search?.view ?? "live-demo-count";

  return (
    <div className="min-w-0">
      <DemoManagerMainContent activeView={activeView} />
    </div>
  );
};

export default DemoManagerFullLayout;
