import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useOperator } from "@/components/vala-ai/session";
import {
  emptyAgentBuild,
  getAgentBuild,
  mountAgentBuild,
  setAgentBuildErrorHandler,
  subscribeAgentBuild,
} from "@/lib/vala-ai/studio/agent-store";

setAgentBuildErrorHandler((message) => toast.error(message));

export function useAgentBuild() {
  const operator = useOperator();
  useEffect(() => mountAgentBuild(operator.id), [operator.id]);
  return useSyncExternalStore(subscribeAgentBuild, getAgentBuild, () => emptyAgentBuild);
}
