# 07 — Submission checklist

## Business and app
- [ ] Business portfolio **verified** (doc 05)
- [ ] App linked to the verified business portfolio
- [ ] Final product name chosen, with no "Insta/Gram/Facebook/FB/Meta" (see `docs/naming.md`), and set in `src/lib/brand.ts` and the app dashboard
- [ ] App icon (1024×1024) uploaded
- [ ] App category set; contact email on your domain

## Public URLs (load logged out, HTTPS, same domain as the app)
- [ ] Privacy Policy: `/privacy`, reviewed by counsel, with the company address filled in (`brand.companyAddress`)
- [ ] Terms: `/terms`
- [ ] Data deletion instructions: `/data-deletion`
- [ ] Data deletion callback: `/api/meta/data-deletion` (tested with a real signed_request)
- [ ] Deauthorize callback: `/api/meta/deauthorize`
- [ ] Landing page explains what the product does and links to the privacy policy

## Technical
- [ ] Facebook Login for Business configuration created; `META_LOGIN_CONFIG_ID` set in Vercel
- [ ] Redirect URI `https://…/api/meta/callback` whitelisted, Strict Mode on
- [ ] "Require App Secret" ON
- [ ] Webhooks: Instagram object verified; `messages` and `comments` fields subscribed
- [ ] Test IG account: "Allow access to messages" enabled under Connected tools
- [ ] End-to-end smoke test from doc 01 §6 passes on production
- [ ] `META_GRAPH_VERSION` set to the current Graph version
- [ ] Vercel Cron running (`/api/cron/sync` returns 200 with `CRON_SECRET`)
- [ ] Reviewer account created and pre-connected, with sample data (doc 04)

## App Review form
- [ ] Requested: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `business_management`
- [ ] (Optional) Human Agent feature
- [ ] Justification text pasted for each permission (doc 02)
- [ ] Screencast uploaded, covering every permission (doc 03)
- [ ] Reviewer instructions pasted (doc 04)
- [ ] Data handling questions answered (doc 06)
- [ ] Each requested permission has been **called successfully at least once** in the
      last 30 days (the dashboard shows a "0 API calls" warning otherwise). Run through the smoke test just before submitting.

## After approval
- [ ] Switch the app to **Live** mode
- [ ] Flip `SIGNUPS_OPEN=true` (if closed for beta)
- [ ] Calendar reminder: annual Data Use Checkup
- [ ] Start the v2 submission: `pages_messaging` for Facebook Page DMs
