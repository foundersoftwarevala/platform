# Operating the live marketplace

Four things run this site — the application host, the Supabase project, the
Cloudflare zone and the GitHub repository — and until now each was reached by
hand, with the credentials pasted somewhere each time. Everything here reads one
git-ignored file and does the same thing the same way every run.

Nothing in this directory contains a credential.

## Once

```bash
cp scripts/ops/env.example .env.ops     # .env.* is already git-ignored
$EDITOR .env.ops                        # fill it in
bash scripts/ops/bootstrap-ssh.sh       # asks for the server password once
```

`bootstrap-ssh.sh` makes a key used for nothing else and installs it on the
server. After that no password is stored, typed or logged, and the key can be
revoked on its own by removing its line from the server's `authorized_keys`.

Two of the values in `env.example` are blank on purpose:

- **`CF_API_TOKEN`** — the value in circulation for this project is the Account
  ID pasted into the token field. Cloudflare answers `6003 Invalid format for
  Authorization header` to it. A real token has to be created; the scopes are
  listed in `env.example`.
- **`SUPABASE_ACCESS_TOKEN`** — a personal access token (`sbp_…`). Only the
  Management API can run SQL, so a migration cannot be applied without it.
  PostgREST, which the service key reaches, can read and call functions but
  cannot run a statement.

## Every day

```bash
scripts/ops/sv.sh help
```

| | |
|---|---|
| `sv.sh verify` | every asset the home page references, against the CDN |
| `sv.sh verify --origin` | the same, straight at the server, skipping Cloudflare |
| `sv.sh deploy` | pull, build, restart, verify, purge — **rolls back on its own** if the new build does not serve its own assets |
| `sv.sh status` / `logs` | what the process is doing |
| `sv.sh assets-on-disk` | what is really in `.output/public/assets` |
| `sv.sh rpc <fn> '<json>'` | call a Postgres function |
| `sv.sh count <table>` | exact row count |
| `sv.sh migrate <file>` | apply one named migration |
| `sv.sh cache-status` | is the CDN caching the page, or is every visitor reaching the server |
| `sv.sh purge` | purge the zone |
| `sv.sh push` / `pr` | push the current branch, open a pull request |

## Why `verify` exists

The home page spent an unknown length of time serving a complete, correct,
964 KB document while eight of its own JavaScript chunks answered `500` — the
entry module among them. React never started. The page looked finished and
nothing on it worked: no search, no favourites, no "Show more", and eighty-one
of the ninety-one category rows never loaded, because all of that is behind
hydration.

Every check that existed said the site was up, because the page itself is `200`.
`verify` asks for each file the page references and fails if any of them is not
`200`, which is why `deploy` runs it before it lets a build stand:

```
==> 118 assets referenced
FAIL  500  /assets/index-B6u7noUL.js
...
FAILED: 8 problem(s). The page will render and then not work.
```

## Pushing

`sv.sh push` refuses to push to `main` and never forces. This repository is
connected to Lovable, and rewriting pushed history rewrites it there too — the
project history is lost, not just reordered.

## Browser tests

`scripts/ops/verify-assets.sh` proves the files load. It cannot prove the page
works. `tests/browser/homepage.spec.ts` drives a real browser to check that it
does — every section top to bottom, the rows paging in, the rails scrolling, the
cards, favourites surviving a reload, the hero taking a swipe, the FAQ grid at
three widths, and the console staying clean.

```bash
npx playwright install chromium          # once
SV_BASE_URL=https://softwarevala.net npx playwright test
SV_BASE_URL=https://softwarevala.net npx playwright test --project=mobile
npx playwright test                      # against a local dev server
```
