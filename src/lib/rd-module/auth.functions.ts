import { createMiddleware } from "@tanstack/react-start";

export const rdOperator = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { requireRdOperator } = await import("./auth.server");
  const operator = await requireRdOperator();
  return next({ context: { rdOperator: operator } });
});
