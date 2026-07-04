# QuoteFoundry — Deployment Guide (Phase 1: Launch plumbing)

Product: QuoteFoundry · Domain: **quotefoundry.app** · Stack: Vercel (static Vite app + serverless API routes) + Supabase + Resend.

---

## 1. Environment variables

Local: `.env.production` (gitignored; used by `npm run build`, `npm run dev:live`, `npm run verify:live`).
Vercel: Project → Settings → Environment Variables — set ALL of these for Production.

| Variable | Where to get it | Exposed to browser? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL (**bare URL, no `/rest/v1/`**) | yes (safe) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` | yes (safe — RLS protects data) |
| `SUPABASE_URL` | same Project URL (read by API routes) | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | **NO — secret. Never VITE_-prefix this.** |
| `RESEND_API_KEY` | Resend → API Keys | no |
| `EMAIL_SEND_DOMAIN` | `send.quotefoundry.app` (after Resend verification, §4) | no |
| `PUBLIC_URL` | `https://quotefoundry.app` | no |
| `TRACKING_SECRET` | any random string, e.g. `openssl rand -hex 24` — signs tracking-pixel URLs | no |
| `VITE_SENTRY_DSN` | Sentry → Project → Client Keys (optional) | yes |

## 2. Supabase setup

1. SQL Editor → run `server/quotefoundry_schema.sql` (done).
   If your project was loaded from an older schema, also run (both idempotent):
   - `server/migrations/2026-07-02_features_phase_minus_1.sql` (feature columns)
   - `server/migrations/2026-07-03_shop_id_defaults.sql` (**required** — stamps `shop_id` on insert; without it every quote/customer save fails with an RLS violation)
2. **Authentication → Sign In / Providers → Email → disable "Confirm email"** for the design-partner phase (sign-up must return a session for `bootstrap_shop` to run; re-enable once a confirmation-email flow is designed). `npm run verify:live` detects and reports this if it's still on.
3. Verify the wiring + isolation from your machine:
   ```
   npm run verify:live
   ```
   This signs up two throwaway shops with the anon key, saves a quote in shop A, and proves shop B can neither read nor modify it (the CLAUDE.md §4.1 adversarial test). Gate is GREEN when all checks pass.

## 3. Vercel setup

1. `vercel.json` is committed (Vite build → `dist/`, SPA rewrite, `/api/*` functions).
2. Import the GitHub repo in Vercel (or `npx vercel`). Framework: Vite (auto-detected).
3. Set the §1 env vars → deploy.
4. Domains: add `quotefoundry.app` (+ `www` redirect) and follow Vercel's DNS instructions at your registrar.

API routes deployed from `api/`:
- `POST /api/send-quote-email` — auth: bearer token; generates the PDF server-side from the frozen snapshot + stored template, re-verifies shop ownership, sends via Resend, marks `sent`.
- `POST /api/generate-pdf` — auth: bearer token; returns the customer PDF.
- `GET /api/track-open?q=…&s=…` — HMAC-signed open pixel; only ever advances `sent → opened`.

## 4. Email DNS (START THIS FIRST — propagation is calendar time)

1. Resend → Domains → Add Domain → **`send.quotefoundry.app`**.
2. Resend shows the exact records to add at your DNS host — typically:
   - TXT (SPF) on `send.quotefoundry.app`
   - CNAME/TXT (DKIM) records Resend generates
   - MX for the bounce subdomain if shown
3. Add a DMARC record (start relaxed, tighten later):
   `TXT _dmarc.quotefoundry.app` → `v=DMARC1; p=none; rua=mailto:datafikr@gmail.com`
4. Wait for Resend to show **Verified** (minutes to hours), then set `EMAIL_SEND_DOMAIN=send.quotefoundry.app`.
5. Deliverability model (locked by CLAUDE.md §4.5): sends go **from** `Shop Name <quotes@send.quotefoundry.app>` with the shop's real email as **reply-to**. Never send "as" the shop's own domain.

## 5. Production round-trip (the Gate-1 checklist)

On the deployed URL, in order:
1. Sign up a real account (shop name + logo) → lands on the pipeline.
2. Rates → confirm seeded defaults; tweak one → Save.
3. New quote → canonical inputs (240 lb, qty 1, burn 35, hrs 1.5/3/4/1.5, outside $85) → quoted price **$1,913.82** → Save.
4. Detail → Preview & send → pick a template → send to yourself.
5. Email arrives in the **inbox** (not spam), PDF attached, logo top-left, no margin/overhead anywhere in it.
6. Open the email → pipeline status advances `sent → opened` within a minute.
7. Detail → Download PDF → matches the sent document.
8. `npm run verify:live` is green.

## 6. Monitoring

- **Sentry:** create a React project at sentry.io, set `VITE_SENTRY_DSN` — init is automatic (and skipped entirely when the DSN is unset).
- **Plausible:** register `quotefoundry.app` at plausible.io — the snippet in `index.html` activates on registration (inert otherwise). Prefer GA4? Swap the snippet.

## 7. Local dev modes

| Command | Backend |
|---|---|
| `npm run dev` | in-memory mock (seeded demo shop) — default for dev/e2e |
| `npm run dev:live` | REAL Supabase from `.env.production` — careful, real data |
| `npm run verify:live` | stage-8 gate against the real project |
