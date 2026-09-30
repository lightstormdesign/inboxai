# 01 — Meta app setup

> Meta renames dashboard menus often. If a label below doesn't match, look for the
> closest equivalent. The concepts stay the same.

## 0. Prerequisites

- A Facebook account with 2FA on. It becomes the app admin.
- A **Meta Business portfolio** (business.facebook.com) for LightStorm Design LLC.
- An **Instagram professional account** (Business or Creator) **linked to a
  Facebook Page** you admin. This is your test account.
- Production domain deployed on Vercel, e.g. `https://app.<yourdomain>.com`.
  Meta needs live HTTPS URLs for the privacy policy, callbacks, and webhooks.
- In the Instagram app on the test account: Settings → Messages and story
  replies → Message controls → **Connected tools → Allow access to messages**.
  Without this the Messaging API returns nothing.

## 1. Create the app

1. developers.facebook.com → My Apps → **Create App**.
2. Use case: **"Other"**, then app type **Business**. You can also pick the
   "Manage messaging & content on Instagram" use case if it's offered.
3. App name: the final product name (see `docs/naming.md`). Contact email: a
   support address on your domain. Business portfolio: LightStorm Design LLC.

## 2. Basic settings (App settings → Basic)

| Field | Value |
|---|---|
| App domains | `<yourdomain>.com` |
| Privacy Policy URL | `https://app.<yourdomain>.com/privacy` |
| Terms of Service URL | `https://app.<yourdomain>.com/terms` |
| User data deletion | **Data deletion callback URL** → `https://app.<yourdomain>.com/api/meta/data-deletion` (instructions page as backup: `/data-deletion`) |
| App icon | 1024×1024 PNG, no Meta/Instagram marks |
| Category | Business and Pages |

Copy the **App ID** and **App Secret** into Vercel env vars `META_APP_ID` and `META_APP_SECRET`.

Under **Advanced** settings:
- **Require App Secret** → ON. Every Graph call we make sends `appsecret_proof`.
- **Deauthorize callback URL** → `https://app.<yourdomain>.com/api/meta/deauthorize`

## 3. Add products

### Facebook Login for Business
1. Add product → **Facebook Login for Business**.
2. Settings → **Valid OAuth Redirect URIs**:
   `https://app.<yourdomain>.com/api/meta/callback` (and
   `http://localhost:3000/api/meta/callback` for local dev; localhost is allowed in dev mode).
3. Turn on Client OAuth login, Web OAuth login, and Enforce HTTPS. Use Strict Mode for redirect URIs.
4. **Configurations → Create configuration**:
   - Name: `InboxAI default`
   - Login variation: **General**
   - Access token type: **User access token**
   - Assets: **Pages** and **Instagram accounts**
   - Permissions (must match `META_SCOPES` in `src/lib/meta/config.ts`):
     - Instagram: `instagram_basic`, `instagram_manage_messages`,
       `instagram_manage_comments`, `instagram_content_publish`
     - Facebook Page: `pages_messaging`, `pages_manage_engagement`,
       `pages_read_user_content`, `pages_manage_posts`
     - Plumbing: `pages_show_list`, `pages_manage_metadata`,
       `pages_read_engagement`, `business_management`
5. Copy the **Configuration ID** into the `META_LOGIN_CONFIG_ID` env var.
   (Without it the app falls back to a classic `scope=` dialog. That's fine for local dev.)

### Instagram (Instagram API with Facebook Login)
Add the Instagram product and choose **API setup with Facebook login**. Nothing else needs configuring.

### Webhooks
1. Add product → **Webhooks**, then select the **Instagram** object.
2. Callback URL: `https://app.<yourdomain>.com/api/meta/webhook`
3. Verify token: a random string. Put the same value in `META_WEBHOOK_VERIFY_TOKEN`.
4. Click **Verify and save**. Our GET handler echoes `hub.challenge`.
5. Subscribe to these fields: **messages**, **comments**, **messaging_postbacks**,
   **message_reactions** (optional), **messaging_seen** (optional).
6. Select the **Page** object with the same callback and verify token, and
   subscribe to **messages**, **message_echoes**, **messaging_postbacks** and
   **feed**. These fields carry Facebook Messenger DMs and Page comments.

### Messenger
Add the **Messenger** product as well (needed for `pages_messaging`). You don't
need to generate tokens there; our OAuth flow gets Page tokens.

In dev mode, webhooks are delivered only for accounts that have a role on the app.
After each Page connects, the OAuth callback calls
`POST /{page-id}/subscribed_apps` so deliveries flow for that Page.

## 4. Roles and test accounts (dev mode = no review needed)

- App roles → **Roles**: add yourself (admin), plus any tester Facebook accounts.
- Each tester connects their own IG professional account through the app.
  They get **Standard Access**, which is enough to exercise every feature.
- To test the DM flow, message the business IG account from a *different*
  personal Instagram account.

## 5. Environment variables on Vercel

```
APP_URL=https://app.<yourdomain>.com
SESSION_SECRET=…            TOKEN_ENCRYPTION_KEY=…
DATABASE_URL=…              (Neon via Vercel Marketplace)
META_APP_ID=…               META_APP_SECRET=…
META_LOGIN_CONFIG_ID=…      META_GRAPH_VERSION=v25.0
META_WEBHOOK_VERIFY_TOKEN=… OPENAI_API_KEY=…
CRON_SECRET=…               SUPPORT_EMAIL / PRIVACY_EMAIL
```

Check `META_GRAPH_VERSION` against the current version listed at
developers.facebook.com/docs/graph-api/changelog, and bump it each time you ship.

## 6. Smoke test before recording

- [ ] `/privacy`, `/terms`, `/data-deletion` load logged-out over HTTPS
- [ ] Webhook "Verify and save" succeeds
- [ ] Connect with Facebook → the IG account shows as Active in Settings → Connections
- [ ] DM the business from another IG account → it appears in the inbox within seconds with a draft
- [ ] Comment on a post → it appears with a draft; Hide and Delete both work
- [ ] Message the Facebook Page from a personal FB account (via Messenger) → it appears with a draft; reply delivers
- [ ] Comment on a Page post → it appears with a draft; reply, Hide and Delete work
- [ ] Publish → Instagram post, Instagram story, and Facebook post each go live
- [ ] "Approve & send" delivers the DM or comment reply on Instagram
- [ ] Remove the app from Facebook Business Integrations → the connection shows "Access removed"
- [ ] Graph API Explorer: `GET /{page-id}/subscribed_apps` lists your app
