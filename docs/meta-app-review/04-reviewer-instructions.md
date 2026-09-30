# 04 — Instructions for the Meta reviewer

Paste the block below into the **"Provide instructions for reviewers"** /
**App verification details** field. Before submitting:

1. Create a dedicated reviewer login in InboxAI (via `/signup`), e.g.
   `meta-review@<yourdomain>.com`, and fill in its voice profile.
2. Pre-connect it to your test business IG account, so the reviewer can see
   the inbox working even if they don't complete the Facebook login themselves.
3. Load a few real test DMs and comments into that inbox.
4. Keep the test IG accounts' passwords somewhere you can hand over if asked.
   Meta usually uses its own test accounts, but it sometimes asks for yours.

---

```
InboxAI is a web app (no mobile install needed): https://app.<yourdomain>.com

WHAT IT DOES
InboxAI is a unified inbox for small businesses. Instagram DMs and comments on
the business's posts appear in one list, each with an AI-suggested reply written
in the business's brand voice. A human reviews/edits each suggestion and must
click "Approve & send" to post it. Nothing is ever sent automatically.

TEST LOGIN
  URL:      https://app.<yourdomain>.com/login
  Email:    meta-review@<yourdomain>.com
  Password: <password>
This account is already connected to our test Instagram business account
@<test_business_handle>, so the inbox already contains sample conversations.

TO TEST THE FACEBOOK LOGIN FLOW
  1. Log in with the credentials above.
  2. Go to "Connections" in the left menu → click "Continue with Facebook".
  3. Log in with a Facebook user that admins a Page linked to an Instagram
     professional account, select that Page + Instagram account, and continue.
  4. You're returned to Connections, and the account shows as "Active".

TO TEST instagram_manage_messages
  1. From any other Instagram account, send a DM to @<test_business_handle>
     (or to the account you connected in step 3).
  2. In InboxAI click "Inbox". The message appears within a few seconds (click
     "Sync now" on the Connections page if needed), with a suggested reply.
  3. Edit the reply if you like, then click "Approve & send".
  4. The reply is delivered to the sender's Instagram DMs.

TO TEST instagram_manage_comments
  1. From another Instagram account, comment on any post by @<test_business_handle>.
  2. In InboxAI the comment appears (labelled "Comment") with the post caption.
  3. Click "Approve & send" to post a public reply, and check it on Instagram.
  4. Click "Hide" to hide the comment, or "Delete" to delete it. Both are
     reflected on Instagram.

DATA DELETION
  Settings → Connections → "Disconnect & delete data" removes the tokens and all
  synced messages. Settings → Account → "Delete account" removes everything.
  Data deletion callback: https://app.<yourdomain>.com/api/meta/data-deletion
  Instructions page:      https://app.<yourdomain>.com/data-deletion

The messaging feature is a human-agent inbox, not an automated bot. There are
no keyword commands to test.
```
