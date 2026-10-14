# Architecture

Software Vala is a single TanStack Start (React 19 + Vite 7) application with two
first-class workspaces that share one design system, one data layer and one AI layer.

## Modules

| Module | Route | Entry component |
| --- | --- | --- |
| R&D Workspace | `/` | `src/routes/index.tsx` |
| Pro Manager | `/pro-manager` | `src/routes/pro-manager.tsx` |

Both routes render the same shell: a persistent sidebar (`RnDSidebar` / `PROSidebar`)
on `lg+`, a `Sheet` drawer (`RnDMobileNav` / `PROMobileNav`) below `lg`, a top bar with
search and live counters, and a `<main>` region that swaps screens by local state.

## Layers

```text
routes/            route shells, session timing, screen switching
components/rnd/    R&D screens and widgets
components/pro-manager/  Pro Manager screens, governance widgets, shared PM UI kit
hooks/             TanStack Query read hooks + mutation/AI action hooks
lib/*.functions.ts thin createServerFn wrappers (RPC boundary)
lib/*.server.ts    server-only logic: AI gateway calls, prompt catalogues
lib/*-types.ts     row types mirroring the database schema
integrations/supabase/  generated clients (browser, admin, auth middleware)
```

Rules that keep the boundary intact:

- `*.functions.ts` files contain only imports and `createServerFn` declarations.
  Server-only modules are pulled in with `await import()` inside handlers.
- Reads go through the browser Supabase client behind read-only RLS policies.
  Writes go through server functions using the service-role client after Zod validation.
- No Supabase Edge Functions; all server logic lives in the app's own server runtime.

## Data flow

1. A screen calls a hook from `useRnDData` / `useProManagerData` (TanStack Query).
2. Mutations call `useRnDAI`, `useProManagerAI` or `useProManagerActions`, which wrap
   server functions with `useServerFn`, then invalidate the relevant query keys.
3. Pro Manager writes append an immutable row to `pm_audit_logs` (`writeAudit`).

## Performance

- Every non-paginated read is capped (`PM_MAX_ROWS`, `RND_MAX_ROWS` = 200).
- Audit log, communication log and the Future Lab idea feed use infinite queries
  (`PM_PAGE_SIZE` 50, `RND_PAGE_SIZE` 30) with server-side `range()` and exact counts.
- Sorting and filtering columns are indexed (see `DATABASE.md`).

## Observability

`src/lib/logger.ts` emits single-line JSON entries (`level`, `scope`, `event`, `error`)
in both browser and server runtimes. It is wired into the query/mutation caches
(`src/router.tsx`), the AI hooks, Pro Manager actions, and the AI gateway handlers.

## Accessibility & responsiveness

Navigation uses `aria-current`, labelled landmarks and 44px minimum tap targets;
icon-only buttons carry `aria-label`; layouts use `min-h-dvh` and grid + `min-w-0`
header rows so text truncates instead of overflowing on small screens.

## Auth

By product decision the app has **no login**. There are no auth routes, no
`_authenticated` subtree and no per-user data; RLS exposes read-only public data
and all writes are validated server-side.
