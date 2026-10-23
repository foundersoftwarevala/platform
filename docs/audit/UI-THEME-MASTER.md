# Manager UI Theme Master

## Source of truth

The manager palette is defined by `.creator-theme` in `src/styles.css`. Its
tokens are already used by the Creator shell and the Marketplace Manager. The
Marketplace Manager’s `.mm-scope` accent override is a compatibility detail;
it is not the shared manager palette and must remain scoped to Marketplace.

| Token | Value |
|---|---|
| Background | `oklch(0.16 0.02 285)` |
| Foreground | `oklch(0.97 0.01 280)` |
| Surface | `oklch(0.21 0.02 285)` |
| Card | `oklch(0.20 0.02 285)` |
| Card foreground | `oklch(0.97 0.01 280)` |
| Primary | `oklch(0.62 0.24 295)` |
| Primary foreground | `oklch(0.99 0.005 285)` |
| Secondary | `oklch(0.28 0.03 285)` |
| Secondary foreground | `oklch(0.97 0.01 280)` |
| Muted | `oklch(0.26 0.02 285)` |
| Muted foreground | `oklch(0.72 0.03 280)` |
| Accent | `oklch(0.32 0.05 295)` |
| Border | `oklch(1 0 0 / 8%)` |
| Input | `oklch(1 0 0 / 10%)` |
| Focus ring | `oklch(0.62 0.24 295 / 60%)` |

Non-Marketplace manager sidebars resolve their tokens from that palette:

| Sidebar token | Resolution |
|---|---|
| Background | `var(--background)` → `oklch(0.16 0.02 285)` |
| Foreground | `var(--foreground)` → `oklch(0.97 0.01 280)` |
| Primary | `var(--primary)` → `oklch(0.62 0.24 295)` |
| Primary foreground | `var(--primary-foreground)` → `oklch(0.99 0.005 285)` |
| Accent | `var(--accent)` → `oklch(0.32 0.05 295)` |
| Accent foreground | `var(--accent-foreground)` → `oklch(0.98 0.01 280)` |
| Border | `var(--border)` → `oklch(1 0 0 / 8%)` |
| Ring | `var(--ring)` → `oklch(0.62 0.24 295 / 60%)` |

## Component mapping

- Sidebar surfaces inherit the theme background; borders use `border-border`.
  Active items use the primary token and muted surfaces are reserved for hover
  and secondary content.
- Headers use the background token with translucency; cards use the card token.
- Primary and outline buttons use the shared UI button component and the
  primary, secondary, border, and muted tokens.
- Tables and forms use the same foreground, muted foreground, border, and input
  tokens as their surrounding manager shell.
- Success, warning, and destructive colors remain semantic status indicators;
  they are not alternate brand palettes.

Do not edit `.creator-theme` token values to restyle one manager: Marketplace
uses this scope too. If a manager needs the shared theme, place `.creator-theme`
on its existing outer shell and use semantic token classes. Sidebar aliases are
scoped to `.creator-theme:not(.mm-scope)` so the Marketplace Manager's
compatibility scope retains its existing sidebar values.
