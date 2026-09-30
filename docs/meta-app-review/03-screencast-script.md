# 03 — Screencast script (≈5–6 minutes)

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
- Window D: a **personal Facebook** account (with a role on the app in dev mode) that messages and comments on the test **Facebook Page**.
- A photo (square or 4:5) and a 9:16 photo for the story, saved on the recording computer.
- The business IG account has at least one post.
- Remove any previous InboxAI grant from Facebook → Settings → Business integrations so the full consent screen appears.
- Voice profile already filled in, so drafts look good. Or do it on camera (scene 2), which shows off the product.
- Screen recorder with click highlighting (e.g. Screen Studio, OBS, Loom).

## Shot list

| Time | Scene | On-screen caption | Permissions shown |
|---|---|---|---|
| 0:00 | Landing page → **Log in** as the test user. Point out the Privacy link in the footer. | "InboxAI helps small businesses answer Instagram and Facebook messages and comments, and publish posts, from one place." | — |
| 0:10 | Connections → **Continue with Facebook**. The Facebook Login for Business dialog opens. | "The business connects its accounts through Facebook Login for Business." | — |
| 0:15 | **Select the Facebook Page** and **the Instagram account**, review the permission list, continue. | "The user chooses exactly which Page and Instagram account to share." | pages_show_list, business_management, instagram_basic |
| 0:30 | Back in the app: "Test Page · Instagram @test_business · Facebook + Instagram · Active". | "Connected. The app subscribes the Page to webhooks for new messages and comments." | pages_manage_metadata |
| **Instagram inbox** | | | |
| 0:40 | Window C: the customer DMs the business: *"Hi! Do you have openings Saturday for 2?"* | "A customer sends an Instagram DM." | — |
| 0:50 | Inbox: the DM appears with the Instagram badge. Open it: **✦ AI draft** in the composer. | "It arrives with a suggested reply in the business's voice." | instagram_manage_messages |
| 1:05 | Edit a word → **Approve & send**. | "Nothing is sent automatically. A person reviews and approves every reply." | — |
| 1:15 | Window C: the reply arrives in Instagram. | "Delivered on Instagram." | instagram_manage_messages |
| 1:30 | Window C comments on a post: *"Is this available in XL?"* In the inbox: Comment tag, post caption, draft. **Approve & send** (public). | "Instagram comments land in the same inbox, with the post they belong to." | instagram_manage_comments, pages_read_engagement |
| 1:55 | Show the reply under the post on Instagram. | | instagram_manage_comments |
| 2:05 | A spam comment arrives → **Hide** → shown hidden on IG → Archived filter → **Delete** → gone on IG. | "Hide or delete spam." | instagram_manage_comments |
| **Facebook Page inbox** | | | |
| 2:50 | Window D: a Facebook user messages the **Page** in Messenger: *"Are you open Sunday?"* | "Facebook Messenger messages to the Page…" | — |
| 3:00 | Inbox: the message appears with the **Facebook** badge and a draft → **Approve & send**. | "…come into the same inbox." | pages_messaging |
| 3:15 | Window D: the reply arrives in Messenger. | "Delivered in Messenger." | pages_messaging |
| 3:30 | Window D comments on a Page post. It appears in the inbox ("Facebook comment") with the post text. | "Facebook Page comments too." | pages_read_user_content |
| 3:45 | **Approve & send** → the reply shows under the Page post. Then a spam comment → **Hide** → **Delete**. | "Reply to or moderate Page comments." | pages_manage_engagement |
| **Publishing** | | | |
| 4:15 | **Publish** page → upload the photo → select **Instagram · Post**, **Instagram · Story**, **Facebook · Page post** → write a caption → **Publish**. | "Businesses can post to Instagram and Facebook from the app." | instagram_content_publish, pages_manage_posts |
| 4:35 | The post list shows each target as "published" → click the ↗ links → show the IG post, the IG story, and the FB Page post live. | "Published only when the user presses Publish." | instagram_content_publish, pages_manage_posts |
| 4:50 | Show **Schedule** with a date/time and the "scheduled" status (optional). | "Or schedule for later." | — |
| **Wrap-up** | | | |
| 5:00 | Brand voice page, a quick scroll. | "Drafts use the voice profile the business sets up." | — |
| 5:10 | Connections → **Disconnect & delete data**; show `/data-deletion`. | "Disconnect and delete data at any time." | — |
| 5:25 | End card. | "Thank you!" | — |

## Tips

- If a webhook is slow on camera, click **Sync now** under Connections. Don't cut the video.
- Record in one take per flow. Short fades between flows are fine.
- Export as MP4 (H.264), under 2 minutes per permission if you split videos. One combined video that covers every permission is usually accepted.
- Keep the raw recording. Reviewers sometimes ask for a specific segment again.
