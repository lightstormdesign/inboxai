import { hmacSha256, safeEqual } from "@/lib/crypto";

/** Verify `X-Hub-Signature-256: sha256=<hex>` against the raw request body. */
export function verifyWebhookSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice("sha256=".length), hmacSha256(appSecret, rawBody, "hex"));
}

export type Channel = "instagram" | "facebook";

export type NormalizedEvent =
  | {
      type: "dm";
      channel: Channel;
      /** The business account the event belongs to: IG user id (instagram) or Page id (facebook). */
      accountId: string;
      /** The customer's IGSID / PSID (sender for inbound, recipient for echoes). */
      customerId: string;
      mid: string;
      text: string;
      attachments: { type: string; url?: string }[];
      timestamp: Date;
      isEcho: boolean;
    }
  | {
      type: "comment";
      channel: Channel;
      accountId: string;
      commentId: string;
      /** Set when this is a reply to another comment. */
      parentId?: string;
      text: string;
      fromId?: string;
      fromUsername?: string;
      fromName?: string;
      /** IG media id, or FB post id. */
      mediaId?: string;
      timestamp: Date;
    };

type MessagingItem = {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    attachments?: { type: string; payload?: { url?: string } }[];
  };
};

type ChangeItem = {
  field: string;
  value: {
    // Instagram `comments`
    id?: string;
    text?: string;
    parent_id?: string;
    from?: { id: string; username?: string; name?: string };
    media?: { id: string };
    // Facebook Page `feed`
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    message?: string;
    created_time?: number;
  };
};

export type WebhookPayload = {
  object: string;
  entry?: { id: string; time?: number; messaging?: MessagingItem[]; changes?: ChangeItem[] }[];
};

function messagingEvents(channel: Channel, accountId: string, items: MessagingItem[] | undefined): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const m of items ?? []) {
    if (!m.message || m.message.is_deleted || !m.sender || !m.recipient) continue;
    const isEcho = Boolean(m.message.is_echo);
    out.push({
      type: "dm",
      channel,
      accountId,
      customerId: isEcho ? m.recipient.id : m.sender.id,
      mid: m.message.mid,
      text: m.message.text ?? "",
      attachments: (m.message.attachments ?? []).map((a) => ({ type: a.type, url: a.payload?.url })),
      timestamp: new Date(m.timestamp ?? Date.now()),
      isEcho,
    });
  }
  return out;
}

/**
 * Turn an `instagram` or `page` webhook delivery into flat events. Unknown
 * fields are ignored (reactions, seen receipts, likes, story mentions).
 */
export function parseMetaWebhook(payload: WebhookPayload): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];

  if (payload.object === "instagram") {
    for (const entry of payload.entry ?? []) {
      out.push(...messagingEvents("instagram", entry.id, entry.messaging));
      for (const c of entry.changes ?? []) {
        if ((c.field !== "comments" && c.field !== "live_comments") || !c.value.id) continue;
        out.push({
          type: "comment",
          channel: "instagram",
          accountId: entry.id,
          commentId: c.value.id,
          parentId: c.value.parent_id,
          text: c.value.text ?? "",
          fromId: c.value.from?.id,
          fromUsername: c.value.from?.username,
          mediaId: c.value.media?.id,
          timestamp: new Date((entry.time ?? Date.now() / 1000) * 1000),
        });
      }
    }
  }

  if (payload.object === "page") {
    for (const entry of payload.entry ?? []) {
      out.push(...messagingEvents("facebook", entry.id, entry.messaging));
      for (const c of entry.changes ?? []) {
        const v = c.value;
        if (c.field !== "feed" || v.item !== "comment" || v.verb !== "add" || !v.comment_id) continue;
        // Top-level comments have parent_id === post_id.
        const isReply = Boolean(v.parent_id && v.parent_id !== v.post_id);
        out.push({
          type: "comment",
          channel: "facebook",
          accountId: entry.id,
          commentId: v.comment_id,
          parentId: isReply ? v.parent_id : undefined,
          text: v.message ?? "",
          fromId: v.from?.id,
          fromName: v.from?.name,
          mediaId: v.post_id,
          timestamp: new Date((v.created_time ?? entry.time ?? Date.now() / 1000) * 1000),
        });
      }
    }
  }

  return out;
}

/** @deprecated use parseMetaWebhook — kept for the Instagram-only call sites/tests. */
export const parseInstagramWebhook = parseMetaWebhook;
