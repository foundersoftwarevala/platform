import { createContext, useContext } from "react";
import type { Operator } from "./api";

export const OperatorContext = createContext<Operator | null>(null);

/** The signed-in Control Panel account. Screens use it only to hide controls; the server enforces every role. */
export function useOperator(): Operator {
  const op = useContext(OperatorContext);
  if (!op) throw new Error("useOperator outside Vala AI session");
  return op;
}

export function useCan(role: "operator" | "owner"): boolean {
  const op = useOperator();
  return role === "owner" ? op.role === "owner" : op.role !== "viewer";
}
