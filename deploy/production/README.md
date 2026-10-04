## Locked demo presentation workflow

Every submitted URL follows the same pipeline: resolve its real product and
category, use the configured OpenAI service, extract contacts from the complete
SPA bundle, apply Software Vala favicon/contact presentation, verify, and publish
only through `/demo/<product-slug>`. The original vendor URL is retained privately
and is not modified. Demo cards lead their related marketplace rows.

JavaScript evidence uses a real lexer so empty strings, long literals, comments
and regular expressions cannot desynchronize contact extraction.

Direct proxied application routes retain their original pathname, query and
fragment when removing the proxy prefix, including employee login deep links.
Official demo contact replacements use the owner's support email
`hellosoftwarevala@gmail.com` and WhatsApp/phone `+91 8348838383`.
Original application account emails and credentials remain unchanged.
Short site-brand labels can use `brandLabels`: exact header/footer text is
replaced without rewriting the same words inside ordinary feature descriptions.
Split inline header/footer labels and Vite lazy module preload assets are also preserved and presented through the isolated demo proxy.

AI findings are accepted only for verified contact and navigation evidence.
Login/account records, form placeholders, SVG geometry/namespaces and API
endpoints remain intact. JavaScript rewrites preserve those properties and
proxy root-relative images/styles. Rewritten text assets are private/no-store,
preventing stale branding without adding entry-only cache queries. Entry modules
and lazy imports share one URL so navigation cannot create duplicate React
instances. Vite relative preload paths retain their leading-slash semantics.

Rendered tables, forms and record contact-information cards retain their data;
explicit public `section#contact`, `section#contact-us` and
`section#contact_us` areas are also eligible for contact replacement even when
their heading is nested separately from the contact cards. Browser-verified
contact rules remain audited; generic record `value` fields stay protected.
only public contact areas are rewritten. The canonical database types include
the existing VPS `user_xp` and `user_streaks` columns, nullability and defaults,
avoiding deep type-instantiation failures on these real wildcard-read relations.

The Add Demo submit action uses `POST /api/demo/process` with `action: "publish"`.
It runs investigation and activation together; category mismatches and failed
verification remain explicit errors, not automatic overrides. Bulk intake keeps
its 500-row, duplicate-safe batches and review gates for unresolved mappings.

## Demo intake and row order

Publication rejects the known unbuilt Lovable starter landing copy rather than
treating HTTP 200 and successful rebranding as proof of a working application.
Confirmed blank upstream previews can be disabled through the audited URL
Manager without deleting their URL or product. A completed source URL is needed.

Live-demo cards precede other cards in each category and curated row. Existing
relative order is preserved inside each group, including country order after
demo cards. Ranking happens before pagination. Apply
`20261004181500_catalog_demo_first.sql` before deploying the catalogue reader.
Bulk intake accepts at most 500 addresses per batch: 12,000 addresses require
24 batches. Preview with `register: false` does not persist a batch or a demo.

# Production server — configuration of record

Everything the production VPS runs that is not application code, kept here so
the server can be rebuilt from GitHub. No secret is in this directory: the
values live only on the server (see "Secrets" below).

| File here                            | Lives on the server at                             | What it is                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy-prod.sh`                     | `/root/deploy-prod.sh`                             | Build and restart the app (`/var/www/softwarevala`, PM2 `softwarevala-staging`), keep the previous build, roll back if the site does not answer |
| `nginx/softwarevala-production.conf` | `/etc/nginx/sites-enabled/softwarevala-production` | TLS termination, proxy to the app on 127.0.0.1:3000, security headers                                                                           |
| `nginx/cloudflare-realip.conf`       | `/etc/nginx/conf.d/cloudflare-realip.conf`         | Trust `CF-Connecting-IP` only from Cloudflare's ranges                                                                                          |
| `system/cf-realip-update.sh`         | `/root/cf-realip-update.sh`                        | Weekly refresh of those ranges (root crontab)                                                                                                   |
| `system/sv-db-backup.py`             | `/usr/local/bin/sv-db-backup.py`                   | Nightly logical database backup (`cron/sv-db-backup`)                                                                                           |
| `system/logrotate-softwarevala`      | `/etc/logrotate.d/softwarevala`                    | Rotation for `/var/log/sv-*.log` and PM2 logs                                                                                                   |
| `system/fail2ban-sshd.local`         | `/etc/fail2ban/jail.d/sshd.local`                  | Ban an address after 5 failed SSH logins in 10 min, for 1 h                                                                                     |
| `cron/*`                             | `/etc/cron.d/*`                                    | Scheduled jobs                                                                                                                                  |
| `cron/root-crontab`                  | `crontab -l` for root                              | Scheduled jobs (translation engine health, backups, sweeps)                                                                                     |

The translation engine has its own deployment in `services/translation-engine/`
(container `sv-translate`, `/opt/sv-translate`).

## Secrets

Not in this repository, by design. The application process needs these
environment variables (names only):

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`, the `VITE_SUPABASE_*`
equivalents, `INTERNAL_API_TOKEN`, `AI_API_CREDENTIAL_ENCRYPTION_KEY`,
`TRANSLATE_PROVIDER_URL`, `TRANSLATE_PROVIDER_TOKEN`,
`TRANSLATION_ALLOW_EXTERNAL`, `TRANSLATION_PROVIDER_ORDER`, `I18N_JOB_WORKER`,
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`,
`SITE_URL`, `APP_BASE_URL`, `HOST`, `PORT`, `NITRO_PORT`, `NITRO_PRESET`,
`NODE_ENV`.

They are in `/var/www/softwarevala/.env` (mode 600) and in the running PM2
process. Scripts read their own credentials from `/etc/sv-i18n-backup.env` and
`/etc/sv-translate.env`. Keep a copy of these in a password manager: without
them a rebuilt server cannot reach the database.

## Rebuilding the server

1. Ubuntu 24.04, `nginx`, `certbot`, Node 22 + `pm2`, Docker, `fail2ban`,
   `ufw` (allow OpenSSH, 80, 443).
2. `git clone` this repository to `/var/www/softwarevala`, check out the
   release commit, restore `.env`, `npm ci`, `npm run build`,
   `pm2 start .output/server/index.mjs --name softwarevala-staging`, `pm2 save`,
   `pm2 startup`.
3. Copy the files above to their places; `nginx -t && systemctl reload nginx`;
   `certbot --nginx -d softwarevala.net -d www.softwarevala.net`.
4. Translation engine: `services/translation-engine/deploy/deploy.sh`.
5. Database: Supabase is managed. Restore from the nightly logical backup
   (`sv-db-backup.py` writes to `/var/backups/softwarevala`, seven days kept)
   only if the project itself is lost.

## Known gaps

- Backups are on the same disk as the server: losing the VPS loses them too.
  They need an off-site copy (object storage).
- One application process: a deploy restarts it (a few seconds of 502), and a
  crash takes the site down until PM2 restarts it.
