/**
 * Who may publish a demo, in one place that both sides can read.
 *
 * The route gate in front of the demo consoles and the server guard behind them
 * each kept their own list, and they drifted: the gate admitted `support` while
 * the pipeline accepted only boss, admin, super_admin, owner and developer, so a
 * support user could open the console and be refused the moment they acted.
 *
 * This file holds no logic and imports nothing, so the browser can read it
 * without pulling the server guard - and its own env access, service key and
 * token comparison - into the client bundle.
 */

/** Roles the demo pipeline accepts. Publishing puts third-party software on the storefront under Software Vala's branding, so it stays narrow. */
export const DEMO_OPERATOR_ROLES = [
  "boss",
  "admin",
  "super_admin",
  "owner",
  "developer",
] as const;

/**
 * The app_roles the demo consoles admit, on top of the platform operators that
 * RequireRole always lets through. `developer` is the whole of the difference.
 */
export const DEMO_ROUTE_ROLES = ["developer"] as const;
