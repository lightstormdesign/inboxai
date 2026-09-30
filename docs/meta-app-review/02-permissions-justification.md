# 02 — Permission justifications

For each permission, paste the text below into **App Review → Permissions and
Features → Request advanced access → "Tell us how you'll use this"**. Replace
`InboxAI` with the final product name and `app.example.com` with your domain.

Reviewers want three things: **what** the feature is, **why** the user benefits,
and **where** it shows up in the screencast. Keep the answers concrete.

---

## instagram_manage_messages  *(core)*

**How will your app use this permission?**

> InboxAI is a customer-messaging inbox for small businesses and creators. After a
> business connects its Instagram professional account via Facebook Login for
> Business, InboxAI uses instagram_manage_messages to (1) receive new direct
> messages sent to that business via the Instagram messaging webhook and read
> recent conversation history, so they are displayed in the business's InboxAI
> inbox; and (2) send the reply that a human staff member writes or approves.
>
> For each incoming message InboxAI shows an AI-suggested draft reply written in
> the business's configured brand voice. The draft is never sent automatically: a
> person at the business must review it, optionally edit it, and press
> "Approve & send". Only then do we call the Send API. Replies are sent within the
> 24-hour standard messaging window; if the customer's last message is 24h–7d old
> the human's reply is sent with the HUMAN_AGENT tag. We do not send
> promotional, bulk, or unsolicited messages.
>
> The business benefits by answering customer questions quickly from one inbox
> alongside their comments. Message content is used only to display the
> conversation and generate the suggested reply for that business, and is deleted
> when the business disconnects or deletes its account.
>
> Screencast: 0:40–1:40 shows a DM arriving from a test account, the draft, the
> edit, the Approve & send tap, and the reply appearing in the Instagram app.

**Is this a custom inbox or an automated experience?** Custom inbox (human agents).
There are no bot flows or keyword commands in v1. Every message is human-approved.

**How to initiate a conversation:** Send a DM from any Instagram account to the test business account `@<test_business_handle>`.

---

## instagram_manage_comments  *(core)*

> InboxAI shows comments left on the connected business's Instagram posts in the
> same unified inbox as DMs, alongside the post caption. It uses
> instagram_manage_comments to (1) read comments and replies on the business's
> own media, received via the `comments` webhook and a periodic sync; (2) post a
> public reply that a human has approved; (3) hide or unhide a comment; and
> (4) delete a comment, both of which are for moderating spam and abuse. Each
> action is triggered only by a person clicking a button in the InboxAI UI. As
> with DMs, an AI-suggested reply is shown as a draft and never posted without
> the user pressing "Approve & send".
>
> Screencast: 1:40–2:40 shows a new comment, the draft, a public reply appearing
> under the post in Instagram, and a spam comment being hidden and then deleted.

---

## instagram_basic

> Used to read the connected Instagram professional account's ID, username and
> profile picture (so the user can confirm which account they connected, shown on
> the Connections page), and to list the account's recent media with captions and
> permalinks, so comments in the inbox show which post they belong to.
>
> Screencast: 0:20 (connected account shown) and 1:45 (post caption above a comment).

---

## pages_show_list

> Instagram professional accounts are accessed through their linked Facebook Page.
> During Facebook Login for Business the user selects which Pages to share. We
> call /me/accounts to find those Pages and their linked Instagram accounts, and
> show them on the Connections page. Without this permission we can't tell which
> Instagram account the user wants to connect.
>
> Screencast: 0:10–0:30.

---

## pages_manage_metadata

> Used once per connected Page to subscribe it to our app's webhooks
> (POST /{page-id}/subscribed_apps). This is what lets new Instagram DMs and
> comments reach the business's InboxAI inbox in real time, instead of us polling.
> We also unsubscribe when the business disconnects.
>
> Screencast: 0:30 (connection completes; new DM arrives in real time at 0:45).

---

## pages_read_engagement

> Required by the Instagram Graph API to read content and engagement data
> (comments, captions, and the linked Instagram account) for the Pages the user
> connected, so they can be shown in the inbox. We read only the Pages the user
> explicitly selected during login.

---

## business_management

> The Instagram accounts and Pages our customers manage are often owned by a
> Meta Business portfolio rather than a personal profile. business_management is
> required as part of Facebook Login for Business for these business-owned assets
> to be granted to our app and returned by /me/accounts. We do not create, modify,
> or manage the user's business portfolio in any way.

---

## Features (if prompted)

- **Human Agent** (for the `HUMAN_AGENT` message tag). Our inbox is staffed by
  humans only. The tag is used only when a person replies to a customer 24h–7d
  after that customer's last message, for example when the business was closed.
  Request it with the same screencast; it shows that a human composes and sends
  each reply.
- **Business Asset User Profile Access** (if the reviewer asks why we show
  usernames and names): we show the sender's username and name next to their
  message so the business knows who it's talking to. We don't store profile
  pictures or build profiles.

---

## Deliberately NOT requested in v1

| Permission | Why not yet |
|---|---|
| `pages_messaging` | Facebook Page (Messenger) inbox is a v2 feature |
| `instagram_content_publish` | Publishing goes through Buffer's API, not ours |
| `instagram_manage_insights` | No analytics in v1 |
| `pages_manage_posts` | Not used |
