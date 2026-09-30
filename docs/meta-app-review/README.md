# Meta App Review — submission kit

Meta App Review is the slowest part of launch. This folder has everything needed
to get **Advanced Access** for the Instagram messaging and comment permissions.
You can build and demo the whole product against your own test accounts while
review is pending.

| # | Doc | What it's for |
|---|-----|---------------|
| 01 | [App setup](01-app-setup.md) | Creating the Meta app, Facebook Login for Business config, webhooks, and dev-mode testing |
| 02 | [Permission justifications](02-permissions-justification.md) | Text to paste into each permission's "How will your app use this?" box |
| 03 | [Screencast script](03-screencast-script.md) | A shot-by-shot script for the demo video, one segment per permission |
| 04 | [Reviewer test instructions](04-reviewer-instructions.md) | Test credentials and steps for the reviewer (pasted into the submission) |
| 05 | [Business verification](05-business-verification.md) | Verifying LightStorm Design LLC in Business Manager |
| 06 | [Data handling answers](06-data-handling.md) | Answers for the Data Use Checkup and Data Protection Assessment |
| 07 | [Submission checklist](07-submission-checklist.md) | Final go/no-go list before you click Submit |

## Plan

```
Week 0   Create Meta app (Business type) → add Instagram + Webhooks + FB Login for Business
         Deploy to Vercel on the real domain → privacy/terms/data-deletion URLs are live
         Start Business Verification (runs in parallel, can take days to weeks)
Week 0-2 Build and test in dev mode with your own IG professional account + test users
         (Standard Access works for anyone with a role on the app: no review needed)
Week 2   Record screencast → fill in justifications → submit
Week 3-4 Review decision (often 1–2 rounds of feedback; fix and resubmit)
```

## Key facts to remember

- **Login type.** We use *Instagram API with Facebook Login* (Facebook Login for
  Business), not "Instagram API with Instagram Login". It's required for a
  multi-tenant tool whose customers manage Pages, and it opens up Facebook Page
  messaging in v2. An app can only use one of the two login types.
- **Tech Provider.** InboxAI serves other businesses, so Meta treats it as a
  Tech Provider. **Advanced Access + Business Verification are required**
  before non-role users can connect.
- **Standard vs. Advanced Access.** Before review, only people with a role on
  the app (admin, developer, tester) can grant permissions. That's enough to
  build, dogfood, and record the screencast.
- **Human-in-the-loop is the core story.** Every reply is sent by a person
  pressing "Approve & send". The reviewer should see that clearly in the video.
  It also matches the conditions for the `HUMAN_AGENT` message tag (replies
  between 24h and 7 days).
- **Don't over-ask.** Only request permissions the screencast visibly uses.
  This submission covers three features, and each permission maps to one of
  them: the **Instagram inbox**, the **Facebook Page inbox** (Messenger +
  comments) and **publishing** (Instagram posts, stories and reels + Facebook
  Page posts). Meta reviews each permission separately, so a rejection on one
  doesn't block the others.
- **Naming.** The app name can't contain "Insta", "Gram", "Facebook", "FB" or
  "Meta". See [../naming.md](../naming.md).

## Code references

| Requirement | Where |
|---|---|
| OAuth start / callback | `src/app/api/meta/connect/route.ts`, `src/app/api/meta/callback/route.ts` |
| Scopes list | `src/lib/meta/config.ts` |
| Webhook verify + receive (signature checked) | `src/app/api/meta/webhook/route.ts` |
| Deauthorize callback | `src/app/api/meta/deauthorize/route.ts` |
| Data deletion callback + status page | `src/app/api/meta/data-deletion/route.ts`, `src/app/(marketing)/data-deletion/status/page.tsx` |
| Privacy / Terms / Deletion instructions | `/privacy`, `/terms`, `/data-deletion` |
| Only send path (requires a human) | `sendReply()` in `src/lib/inbox.ts`, called only from `POST /api/inbox/[id]/send` with `approved: true` |
| Token encryption | `src/lib/crypto.ts` (AES-256-GCM), `appsecret_proof` in `src/lib/meta/graph.ts` |
