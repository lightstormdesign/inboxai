# Roadmap

## v1 (this repo, targeting Meta App Review)
- [x] Multi-tenant workspaces, email/password auth, encrypted third-party tokens
- [x] Facebook Login for Business → connect IG professional accounts (via Pages)
- [x] Webhooks (DMs + comments) with signature verification; cron safety-net sync
- [x] Unified inbox (DMs + comments), sorted by recency, filters, intent tags, "needs attention"
- [x] OpenAI drafts in the brand voice (structured output, FAQ-grounded, spam detection)
- [x] Human approval required for every send; 24h / HUMAN_AGENT 7-day window handling
- [x] Comment reply (public or private DM), hide, delete
- [x] Buffer post scheduling (API key; Buffer has no third-party OAuth yet)
- [x] Privacy, Terms, Data deletion page + callback + status; deauthorize callback
- [x] Sample-data mode for demos before Meta approval
- [ ] Stripe billing (per workspace; e.g. $19/$49 tiers by connected accounts and draft volume)
- [ ] Password reset + email verification (Resend)
- [ ] Team invites (the memberships table already supports roles)
- [ ] Error monitoring (Sentry) + uptime check on the webhook URL

## v2
- **Facebook Page inbox**: request `pages_messaging` (+ `pages_manage_engagement`,
  `pages_read_user_content` for FB comments). Page webhooks are already subscribed
  (`messages`, `feed`). Add a `page` branch to `parseInstagramWebhook` and send via
  `/{page-id}/messages` without `platform=instagram`.
- **ManyChat**: ManyChat's API manages *subscribers, tags, custom fields and
  flows*. It isn't a raw DM API. Planned use:
  - "Send to ManyChat flow" button on a thread (`/fb/sending/sendFlow` with the
    subscriber id) for things like a booking flow.
  - Tag subscribers from InboxAI intents (lead → `lead` tag).
  - Per-workspace ManyChat API key, stored encrypted like Buffer's.
  - Caution: if a customer runs ManyChat automations **and** InboxAI on the same IG
    account, both receive webhooks. Make sure ManyChat flows and human replies don't
    talk over each other (use ManyChat's "live chat" pause, or only draft when ManyChat is idle).
- Opt-in **auto-send for high-confidence FAQs** (only after v1 draft/edit metrics show
  it's safe: `drafts.final_text` vs `drafts.text` gives an edit rate per intent).
- Saved replies / snippets; per-thread notes; assignment to teammates.
- Voice learning: suggest voice-profile updates from edits humans make.
- More channels: TikTok comments, Google Business Profile reviews, email.
