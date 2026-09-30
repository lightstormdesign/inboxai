# Roadmap

## v1 (this repo, targeting Meta App Review)
- [x] Multi-tenant workspaces, email/password auth, encrypted third-party tokens
- [x] Facebook Login for Business → connect IG professional accounts (via Pages)
- [x] Webhooks (DMs + comments) with signature verification; cron safety-net sync
- [x] Unified inbox (DMs + comments), sorted by recency, filters, intent tags, "needs attention"
- [x] OpenAI drafts in the brand voice (structured output, FAQ-grounded, spam detection)
- [x] Human approval required for every send; 24h / HUMAN_AGENT 7-day window handling
- [x] Comment reply (public or private DM), hide, delete
- [x] Facebook Page inbox: Messenger DMs + Page comments (reply, private reply, hide, delete)
- [x] Direct publishing: Instagram feed posts, stories and reels; Facebook Page posts; now or scheduled
- [x] Media uploads via Vercel Blob
- [x] Buffer as an optional extra target ("Connect with Buffer" OAuth + API-key fallback)
- [x] Privacy, Terms, Data deletion page + callback + status; deauthorize callback
- [x] Sample-data mode for demos before Meta approval
- [ ] Stripe billing (per workspace; e.g. $19/$49 tiers by connected accounts and draft volume)
- [ ] Password reset + email verification (Resend)
- [ ] Team invites (the memberships table already supports roles)
- [ ] Error monitoring (Sentry) + uptime check on the webhook URL

## v2
- **Voice notes**: transcribe inbound voice messages (OpenAI transcription) so they get drafts; a record button
  to send your own voice note (IG/Messenger `audio` attachments).
- **Hands-free / voice approval**: listen to new messages, dictate edits, say "send it" (explicit confirmation phrase).
- **AI hardware (Raspberry Pi 5 / NVIDIA Jetson)**: device pairing via the OAuth device-code flow, scoped device
  tokens (read inbox + send approved replies only), wake word + speech-to-text + TTS on device or via OpenAI.
- **Email**: start with a per-workspace forwarding address + outbound via Postmark/Resend; then Microsoft 365
  (Graph API); Gmail last (restricted scopes need Google's annual CASA security assessment).
- **Other networks for publishing**: TikTok (Content Posting API, requires audit) and LinkedIn (Community
  Management API, requires approval), or via Buffer for customers who have it. Neither offers third-party DM access.
- **ManyChat** (only if customers ask): "send to ManyChat flow" and tag sync for customers already running
  ManyChat automations, so the two don't talk over each other.
- **Embedding in other products** (e.g. the Entry app, GoHighLevel marketplace): expose a small API
  (list threads, get draft, approve/send) so other LightStorm products use this app as the messaging engine.
- Opt-in auto-send for high-confidence FAQs (only after edit-rate metrics show it's safe).
- Saved replies, notes, assignment; voice-profile learning from human edits.
