# InboxAI *(working name)*

An inbox for creators and small businesses. Instagram DMs and comments land in one
place, and each arrives with an **AI-drafted reply in the business's own voice**. A
human approves every reply before it's sent. Posts can be scheduled through Buffer.

Built by LightStorm Design LLC. Standalone codebase.

- **Stack:** Next.js 16 · React 19 · Postgres + Drizzle · Tailwind v4 · OpenAI · Meta Graph API · Buffer GraphQL API
- **Hosting:** Vercel (with Vercel Cron) + Neon Postgres (Vercel Marketplace)
- **Meta App Review kit:** [`docs/meta-app-review/`](docs/meta-app-review/README.md)
- Also see: [architecture](docs/architecture.md) · [roadmap (incl. ManyChat, FB Pages)](docs/roadmap.md) · [name ideas](docs/naming.md)

## Quick start (local)

```bash
npm install
cp .env.example .env.local        # fill in SESSION_SECRET, TOKEN_ENCRYPTION_KEY, DATABASE_URL
# generate secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

npm run db:migrate                # applies drizzle/*.sql
npm run dev                       # http://localhost:3000
```

Then sign up, fill in your brand voice, and click **Load sample conversations**.
The whole inbox works without Meta or OpenAI keys: drafts come from an offline stub
until `OPENAI_API_KEY` is set.

To connect a real Instagram account in development, set `META_APP_ID` and
`META_APP_SECRET`, and add yourself as a role on the Meta app (no review needed for
app roles). See [docs/meta-app-review/01-app-setup.md](docs/meta-app-review/01-app-setup.md).

## Deploy to Vercel

1. Import the repo in Vercel.
2. Storage → add **Neon** Postgres. That sets `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.
3. Add the remaining env vars from `.env.example` (`APP_URL` = your production URL).
4. Run migrations against production once: `DATABASE_URL=… npm run db:migrate`,
   or add `npm run db:migrate &&` to the Vercel build command.
5. Set `CRON_SECRET`. Vercel Cron calls `/api/cron/sync` every 15 min (Pro plan; on
   Hobby change `vercel.json` to a daily schedule).
6. Point your domain at the deployment, then follow the Meta setup doc.

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | TypeScript type-check |
| `npm test` | Vitest unit tests (crypto, webhook/signed-request verification, prompt builder, messaging window) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

## Project layout

```
src/
  app/
    (marketing)/         landing, /privacy, /terms, /data-deletion (+ /status)
    (auth)/              /login, /signup
    app/                 authenticated app: inbox, onboarding, schedule, settings/*
    api/meta/            connect, callback, webhook, deauthorize, data-deletion
    api/inbox/           list, [id]/detail|draft|send|moderate|status
    api/cron/sync        Vercel Cron safety-net sync + retention
    actions.ts           server actions (auth, voice, Buffer, account deletion…)
  lib/
    meta/                Graph client, OAuth, Instagram calls, webhooks, signed_request
    ai/                  prompt builder (pure) + OpenAI drafting
    inbox.ts             ingest, draft, send (human-approved only), moderate
    sync.ts              pull-based backfill
    buffer.ts            Buffer GraphQL client
    crypto.ts            AES-256-GCM token encryption, scrypt, HMAC helpers
    compliance.ts        data deletion / deauthorize / retention
  db/schema.ts           Drizzle schema (multi-tenant)
docs/meta-app-review/    everything for the Meta submission
```

## Product guardrails (v1)

- **Never auto-send.** `sendReply()` is the only code path that posts to Meta, and it's
  reachable only from an authenticated user action that includes `approved: true`.
- Drafts only state facts from the business's FAQ/profile, and flag complaints,
  refunds, and legal/safety topics for attention.
- Replies respect Meta's 24h window (and the 7-day HUMAN_AGENT window).
