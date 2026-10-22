import { createMiddleware } from "@tanstack/react-start";
import type { Role } from "../auth.server";

export async function requireStudioRole(role: Role) {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { resolveCaller } = await import("../platform-auth.server");
  const { requireRole } = await import("../auth.server");
  return requireRole(await resolveCaller(getRequest()), role);
}

export const studioViewer = createMiddleware({ type: "function" }).server(async ({ next }) => {
  return next({ context: { studioOperator: await requireStudioRole("viewer") } });
});

export const studioOperator = createMiddleware({ type: "function" }).server(async ({ next }) => {
  return next({ context: { studioOperator: await requireStudioRole("operator") } });
});

export const studioOwner = createMiddleware({ type: "function" }).server(async ({ next }) => {
  return next({ context: { studioOperator: await requireStudioRole("boss") } });
});
