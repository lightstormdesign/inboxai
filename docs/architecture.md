# Architecture

```
                 ┌──────────── Vercel (Next.js 16, App Router) ─────────────┐
 Browser ──────► │ Pages (RSC) + server actions  │  Route handlers /api/*   │
                 │  /app/inbox  /app/settings/*  │  meta/connect, callback  │
                 │  /privacy /terms /data-deletion│ meta/webhook  (POST/GET) │
                 │                                │ meta/deauthorize, data-deletion
                 │                                │ inbox/[id]/draft|send|moderate
                 │                                │ cron/sync  (Vercel Cron) │
                 └───────┬───────────────┬────────┴──────────┬──────────────┘
                         │               │                   │
                 Postgres (Neon)   OpenAI Responses API   Meta Graph API ◄── webhooks
                 drizzle-orm       (draft only)           Buffer GraphQL API
```

## Stack
- **Next.js 16** (App Router, React 19, server actions, `after()` for post-response work)
- **Postgres + Drizzle ORM** (`postgres.js` driver, `prepare: false` for poolers)
- **Tailwind CSS v4**
- **OpenAI** Responses API with Structured Outputs (JSON schema), `store: false`
- No auth vendor: a small session implementation (scrypt passwords, hashed session
  tokens in the DB, httpOnly cookie). Easy to swap for Clerk or Auth.js later.

## Tenancy
`workspaces` is the tenant. Every inbox row carries `workspace_id`, and every
user-facing query filters on it (`loadOwnedThread` in `src/lib/inbox.ts`). A user
has one workspace in v1; `memberships` already supports teams.

## Data flow: incoming message
1. Meta POSTs `/api/meta/webhook`. We verify `X-Hub-Signature-256`, store the raw
   payload in `webhook_events`, and **return 200 immediately**.
2. In `after()`: `parseInstagramWebhook` → `ingestEvent` upserts the `threads` row and
   inserts the `messages` row. It is idempotent via unique `(thread_id, external_id)`,
   so retries and send echoes are no-ops.
3. For inbound messages, `refreshDraft` builds the prompt (voice profile + last
   12 messages + post caption), calls OpenAI, and stores a `drafts` row with status
   `pending`. It also stores intent and needs-attention on the thread.
4. The inbox UI polls `/api/inbox/list` every 15s.

## Data flow: reply
The UI calls `POST /api/inbox/[id]/send` with `{text, draftId, approved: true}`.
`sendReply` then checks ownership, checks the messaging window (24h standard /
7d HUMAN_AGENT), calls Graph, records the outbound message with `sent_by_user_id`,
marks the draft `sent` with `final_text`, and writes the audit log.
**No other code path posts to Meta.**

## Publishing
The Publish page uploads media straight from the browser to Vercel Blob (`/api/upload`),
then `createPost` (`src/lib/publishing.ts`) stores a `posts` row plus one `post_targets`
row per destination (IG feed/story/reel, FB Page post, Buffer channel). "Post now" publishes
inline. Scheduled posts are picked up by `/api/cron/publish`. Instagram is two-step
(container → publish); videos that are still processing stay `processing` and the cron
finishes them. Buffer targets are handed to Buffer immediately with `dueAt`, since
Buffer does its own scheduling.

## Backfill and safety net
The OAuth callback triggers `syncConnection` in `after()`: recent conversations +
recent media comments, drafting up to 15 open threads. Vercel Cron runs the same
sync once a day (`vercel.json`, which works on the Hobby plan). On Pro, switch it
to every 15 minutes for faster recovery from missed webhooks.

## Secrets
- Meta Page tokens and Buffer keys: AES-256-GCM with a key id, so keys can rotate.
- `appsecret_proof` on every Graph call.
- OAuth `state` is HMAC-signed and bound to a short-lived httpOnly nonce cookie + user + workspace.

## Running locally
See the README. Without `OPENAI_API_KEY` drafts come from a clearly labelled offline
stub. Without Meta credentials, use **Load sample conversations**.
