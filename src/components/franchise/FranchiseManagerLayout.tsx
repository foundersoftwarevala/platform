import { ManagerWorkspace } from "@/components/manager-suite/ManagerWorkspace";
import { franchiseGroups, franchisePrimary } from "./navigation";
import { franchiseRegistry } from "./sectionRegistry";

export function FranchiseManagerLayout() {
  return (
    <ManagerWorkspace
      primary={franchisePrimary}
      groups={franchiseGroups}
      registry={franchiseRegistry}
      brand="Franchise Command"
      brandMark="FC"
      initial="Command Console"
      role="franchise"
    />
  );
}
