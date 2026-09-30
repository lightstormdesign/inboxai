import { hmacSha256, safeEqual } from "@/lib/crypto";

/** Verify `X-Hub-Signature-256: sha256=<hex>` against the raw request body. */
export function verifyWebhookSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice("sha256=".length), hmacSha256(appSecret, rawBody, "hex"));
}

export type NormalizedEvent =
  | {
      type: "dm";
      /** The business's Instagram account id (entry.id). */
      accountId: string;
      /** The customer's IGSID (sender for inbound, recipient for echoes). */
      customerId: string;
      mid: string;
      text: string;
      attachments: { type: string; url?: string }[];
      timestamp: Date;
      isEcho: boolean;
    }
  | {
      type: "comment";
      accountId: string;
      commentId: string;
      parentId?: string;
      text: string;
      fromId?: string;
      fromUsername?: string;
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
    id?: string;
    text?: string;
    parent_id?: string;
    from?: { id: string; username?: string };
    media?: { id: string };
  };
};

type WebhookPayload = {
  object: string;
  entry?: { id: string; time?: number; messaging?: MessagingItem[]; changes?: ChangeItem[] }[];
};

/**
 * Turn an `instagram` webhook delivery into flat events. Unknown fields are
 * ignored (reactions, seen, story mentions — easy to add later).
 */
export function parseInstagramWebhook(payload: WebhookPayload): NormalizedEvent[] {
  if (payload.object !== "instagram") return [];
  const out: NormalizedEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      if (!m.message || m.message.is_deleted || !m.sender || !m.recipient) continue;
      const isEcho = Boolean(m.message.is_echo);
      out.push({
        type: "dm",
        accountId: entry.id,
        customerId: isEcho ? m.recipient.id : m.sender.id,
        mid: m.message.mid,
        text: m.message.text ?? "",
        attachments: (m.message.attachments ?? []).map((a) => ({ type: a.type, url: a.payload?.url })),
        timestamp: new Date(m.timestamp ?? Date.now()),
        isEcho,
      });
    }
    for (const c of entry.changes ?? []) {
      if ((c.field !== "comments" && c.field !== "live_comments") || !c.value.id) continue;
      out.push({
        type: "comment",
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
  return out;
}
