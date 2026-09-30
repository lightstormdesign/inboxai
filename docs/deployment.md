# Deployment guide (Vercel + Neon)

Plan on about 45 minutes the first time. You need a GitHub account (the repo is
already there), a Vercel account, a domain, and an OpenAI API key. Meta setup is
separate (see step 8) and can come after the app is live.

---

## 1. Merge the code to `main`

The code currently lives on `claude/inboxai-saas-setup-ew3mdr`. Open a pull
request into `main` on GitHub and merge it. Vercel deploys `main` to production
and every other branch to a preview URL.

## 2. Create the Vercel project

1. vercel.com → **Add New… → Project** → import `lightstormdesign/inboxai`.
2. Framework preset: **Next.js** (auto-detected). Leave the build and output
   settings alone: `vercel.json` already sets the build command to
   `npm run build:vercel`, which applies database migrations and then builds.
3. Don't click Deploy yet. Add the database and env vars first (steps 3–4).
   If you already deployed, that's fine: just redeploy after step 4.

## 3. Add the database (Neon, via Vercel Marketplace)

1. In the project: **Storage → Create Database → Neon (Serverless Postgres)**.
2. Region: pick the one closest to your Vercel functions (default `iad1` / US East → Neon `us-east-1`).
3. Connect it to the project for **Production** and **Preview**.
   This automatically sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
4. Optional but recommended: in the Neon integration settings, turn on
   **"Create a database branch for each preview deployment"**, so preview
   deploys never touch production data.

Migrations run automatically on every deploy (`scripts/migrate-if-configured.mjs`).

**Also add a Blob store** (for photo/video uploads on the Publish page):
**Storage → Create → Blob** → connect it to the project. This sets
`BLOB_READ_WRITE_TOKEN` automatically. Without it, the Publish page falls back to
pasting a public media URL.

## 4. Environment variables

Project → **Settings → Environment Variables**. Generate each secret on your
own computer with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Variable | Value | Environments |
|---|---|---|
| `APP_URL` | `https://app.yourdomain.com` (production), no trailing slash | Production |
| `SESSION_SECRET` | random (command above) | All |
| `TOKEN_ENCRYPTION_KEY` | random (command above), **separate from SESSION_SECRET** | All |
| `SUPPORT_EMAIL` | `support@yourdomain.com` | All |
| `PRIVACY_EMAIL` | `privacy@yourdomain.com` | All |
| `OPENAI_API_KEY` | from platform.openai.com → API keys | All |
| `OPENAI_MODEL` | `gpt-5.4-mini` (or newer) | All |
| `CRON_SECRET` | random | Production |
| `SIGNUPS_OPEN` | `false` until launch (so only you and the Meta reviewer have accounts), then `true` | All |
| `META_APP_ID` | from Meta app dashboard (step 8) | All |
| `META_APP_SECRET` | from Meta app dashboard | All |
| `META_LOGIN_CONFIG_ID` | from Facebook Login for Business → Configurations | All |
| `META_GRAPH_VERSION` | `v25.0` (check the current version) | All |
| `META_WEBHOOK_VERIFY_TOKEN` | random | All |
| `BUFFER_CLIENT_ID` / `BUFFER_CLIENT_SECRET` | Optional. From Buffer → Settings → API (register an OAuth app with redirect `https://app.yourdomain.com/api/buffer/callback`) | All |

**Back up `TOKEN_ENCRYPTION_KEY` in a password manager.** If it's lost, every
connected account has to reconnect. To rotate it, move the old value into
`TOKEN_ENCRYPTION_KEY_PREVIOUS` and set a new `TOKEN_ENCRYPTION_KEY`.

You can deploy before you have the Meta values. The app works, and the
Connections page says Meta isn't configured yet. Note that `SIGNUPS_OPEN=false`
blocks the `/signup` form, so to create your own account, set it to `true`,
sign up, then set it back to `false` and redeploy.

For preview deployments, `APP_URL` can be left unset in Preview if you only use
previews to click around. Meta login only works on the production domain.

## 5. Deploy

**Deployments → Redeploy** (or push to `main`). In the build log, look for
`[migrate] Applying database migrations…` followed by a successful Next.js build.

## 6. Custom domain

1. Project → **Settings → Domains** → add `app.yourdomain.com`.
2. At your DNS provider, add the CNAME record Vercel shows (usually `cname.vercel-dns.com`).
3. Wait for the certificate. HTTPS is required for Meta.
4. Make sure `APP_URL` matches this domain exactly, then redeploy.

The marketing site can live on the root domain later. For Meta, the privacy
policy just needs to be on a domain listed under the app's "App domains".

## 7. Cron (backup sync)

`vercel.json` defines two cron jobs, both **once a day** so a Hobby-plan deploy works:

| Job | What it does | Recommended on Pro |
|---|---|---|
| `/api/cron/sync` | Catches any DMs/comments a webhook missed | `*/15 * * * *` |
| `/api/cron/publish` | Publishes **scheduled** posts that are due, and finishes processing videos | `*/5 * * * *` |

**Scheduled posts need Pro.** On Hobby, a post scheduled for 3pm would only go
out at the next daily run. "Post now" works on any plan. Edit the schedules in
`vercel.json` after upgrading. Vercel sends `CRON_SECRET` automatically; the route rejects any
request without it.

Check it: Project → **Settings → Cron Jobs** → **Run** → it should return 200.

## 8. Meta app

Follow [`meta-app-review/01-app-setup.md`](meta-app-review/01-app-setup.md). The URLs it needs:

| Meta setting | URL |
|---|---|
| Privacy Policy | `https://app.yourdomain.com/privacy` |
| Terms | `https://app.yourdomain.com/terms` |
| OAuth redirect URI | `https://app.yourdomain.com/api/meta/callback` |
| Webhook callback | `https://app.yourdomain.com/api/meta/webhook` |
| Deauthorize callback | `https://app.yourdomain.com/api/meta/deauthorize` |
| Data deletion callback | `https://app.yourdomain.com/api/meta/data-deletion` |

After adding the `META_*` env vars, **redeploy** (env vars only apply to new deployments).

## 9. Post-deploy checklist

- [ ] `https://app.yourdomain.com` loads; `/privacy`, `/terms`, `/data-deletion` load logged out
- [ ] Sign up works (temporarily set `SIGNUPS_OPEN=true` if you closed it), and you land on onboarding
- [ ] Inbox → **Load sample conversations**: drafts appear and are **not** labelled "offline placeholder" (that label means `OPENAI_API_KEY` is missing)
- [ ] Meta webhook **Verify and save** succeeds
- [ ] Connections → **Continue with Facebook** → your IG account shows "Active"
- [ ] A DM from a second IG account appears in the inbox with a draft; Approve & send delivers it
- [ ] Publish → "Post now" with a photo to Instagram and Facebook → each shows "published"
- [ ] Cron job manual run returns 200

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails at `drizzle-kit migrate` | Check `DATABASE_URL_UNPOOLED` is set (Neon integration) and the Neon project isn't suspended |
| 500 error on every page, logs mention `SESSION_SECRET` / `TOKEN_ENCRYPTION_KEY` | Missing env var; add it and redeploy |
| "Meta app credentials aren't configured" | Add `META_APP_ID` / `META_APP_SECRET`, then redeploy |
| Facebook says "URL blocked" / redirect mismatch | The redirect URI in Facebook Login for Business must exactly match `APP_URL` + `/api/meta/callback` |
| Webhook verification fails | `META_WEBHOOK_VERIFY_TOKEN` must equal the token typed into the Meta dashboard, and you must redeploy after setting it |
| Connected, but DMs never arrive | In the Instagram app: Settings → Messages → Connected tools → allow access to messages. In dev mode, only accounts with a role on the Meta app deliver webhooks |
| Drafts say "Offline placeholder" | `OPENAI_API_KEY` is missing |

## Costs to expect at launch

| Service | Plan | Approx. |
|---|---|---|
| Vercel | Hobby (non-commercial use only). **Pro ($20/mo) once you charge customers** | $0–20/mo |
| Neon | Free tier, then Launch | $0–19/mo |
| OpenAI | `gpt-5.4-mini` drafts cost a fraction of a cent each | Usage-based |
| Domain | Annual | ~$15/yr |

Vercel's Hobby plan terms don't allow commercial use, so move to Pro before
taking payments.
