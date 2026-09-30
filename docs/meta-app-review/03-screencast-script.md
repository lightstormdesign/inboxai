# 03 — Screencast script (≈3–4 minutes)

Meta rejects most first submissions because of the video. Rules that matter:

- **Show the full login flow**: click "Continue with Facebook", log in, **pick the
  Page and IG account**, grant permissions, return to the app.
- **Show every requested permission being used**, and the result **on
  Instagram itself**: the DM arriving in the IG app, the comment reply appearing
  under the post.
- **English UI**, readable at 1080p, cursor visible, no cuts in the middle of a flow.
  Add captions or on-screen text explaining each step. Voice-over is optional; captions are safer.
- **Use real, working builds** on the production URL, not mockups.
- Use your dev-mode test accounts (you have Standard Access, which is enough to record).

## Setup before recording

- Browser window A (1920×1080): InboxAI production URL, logged out, fresh account ready to sign up (or a test login).
- Phone mirrored on screen, or window B: the **business** IG account (`@<test_business>`) in the Instagram app or web.
- Phone or window C: a **personal** IG account (`@<test_customer>`) that will send the DM and comment.
- The business IG account has at least one post.
- Remove any previous InboxAI grant from Facebook → Settings → Business integrations so the full consent screen appears.
- Voice profile already filled in, so drafts look good. Or do it on camera (scene 2), which shows off the product.
- Screen recorder with click highlighting (e.g. Screen Studio, OBS, Loom).

## Shot list

| Time | Scene | On-screen caption | Permissions shown |
|---|---|---|---|
| 0:00 | Landing page → **Log in** as the test user. Mention the Privacy link in the footer. | "InboxAI helps small businesses answer Instagram DMs and comments from one inbox." | — |
| 0:10 | Settings → Connections → click **Continue with Facebook**. The Facebook Login for Business dialog opens. | "Business connects their Instagram account via Facebook Login for Business." | — |
| 0:15 | In the dialog, **select the Facebook Page** and **the Instagram account**, review the permission list, click Continue/Save. | "The user chooses exactly which Page and Instagram account to share." | pages_show_list, business_management, instagram_basic |
| 0:30 | Back in InboxAI: the connection shows **@test_business · Active**. | "Account connected. InboxAI subscribes the Page to webhooks for new messages and comments." | pages_manage_metadata, instagram_basic |
| 0:40 | Window C: the customer account DMs the business: *"Hi! Do you have openings Saturday for 2?"* | "A customer sends a DM on Instagram." | — |
| 0:50 | InboxAI Inbox: the DM appears at the top (reload if needed). Click it. The conversation shows, with an **✦ AI draft** in the composer. | "The DM arrives in the inbox with a suggested reply in the business's voice." | instagram_manage_messages (read) |
| 1:05 | **Edit the draft** (change a word), then click **Approve & send**. | "Nothing is sent automatically. A person reviews, edits, and approves every reply." | — |
| 1:15 | Window C: the reply arrives in the customer's Instagram DMs. | "The approved reply is delivered on Instagram." | instagram_manage_messages (send) |
| 1:30 | Window C: the customer **comments** on the business's post: *"Is this available in XL?"* | "A customer comments on a post." | — |
| 1:40 | InboxAI: the comment appears (tagged COMMENT) with the post caption shown above it and an AI draft. | "Comments show up in the same inbox, with the post they belong to." | instagram_manage_comments (read), instagram_basic, pages_read_engagement |
| 1:55 | Click **Approve & send** (Reply publicly). | | instagram_manage_comments (reply) |
| 2:05 | Window B/C: open the post; the business's reply appears under the comment. | "The reply is posted publicly under the comment." | |
| 2:15 | Customer leaves a spammy comment: *"Get 10k followers FAST"*. In InboxAI, click it, then **Hide**. Show it hidden on IG (from the business view). | "Businesses can hide spam or abusive comments…" | instagram_manage_comments (hide) |
| 2:35 | Filter **Archived**, open it, click **Delete**, confirm. Show it's gone on IG. | "…or delete them." | instagram_manage_comments (delete) |
| 2:50 | Settings → **Brand voice** page, a quick scroll. | "Drafts use the voice profile the business sets up." | — |
| 3:00 | Settings → Connections → **Disconnect & delete data**; then show `/data-deletion`. | "Businesses can disconnect and delete their data at any time." | — |
| 3:15 | End card. | "Thank you!" | — |

## Tips

- If a webhook is slow on camera, click **Sync now** under Connections. Don't cut the video.
- Record in one take per flow. Short fades between flows are fine.
- Export as MP4 (H.264), under 2 minutes per permission if you split videos. One combined video that covers every permission is usually accepted.
- Keep the raw recording. Reviewers sometimes ask for a specific segment again.
