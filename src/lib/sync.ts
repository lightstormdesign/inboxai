import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { drafts, metaConnections, messages, threads, type MetaConnection } from "@/db/schema";
import { GraphError } from "@/lib/meta/graph";
import * as fb from "@/lib/meta/facebook";
import * as ig from "@/lib/meta/instagram";
import type { NormalizedEvent } from "@/lib/meta/webhooks";
import { ingestEvent, pageToken, refreshDraftSafe } from "@/lib/inbox";

/**
 * Pull-based sync. Webhooks are the primary feed; this backfills on first
 * connect and runs from Vercel Cron as a safety net for missed deliveries.
 */
export async function syncConnection(conn: MetaConnection, opts: { draftLimit?: number } = {}) {
  if (conn.status !== "active") return { threads: 0 };
  const token = pageToken(conn);
  const touched = new Set<string>();

  try {
    const events: NormalizedEvent[] = [];

    // ── Instagram (only if the Page has a linked IG professional account)
    if (conn.igUserId) {
      const igId = conn.igUserId;
      for (const convo of await ig.listConversations(conn.pageId, token, 1)) {
        for (const m of convo.messages?.data ?? []) {
          const isEcho = m.from.id === igId;
          const customer = isEcho ? m.to?.data[0]?.id : m.from.id;
          if (customer) events.push(dmEvent("instagram", igId, customer, isEcho, m));
        }
      }
      for (const media of await ig.listRecentMediaWithComments(igId, token)) {
        for (const c of media.comments?.data ?? []) {
          events.push(igCommentEvent(igId, media.id, c));
          for (const r of c.replies?.data ?? []) events.push(igCommentEvent(igId, media.id, r, c.id));
        }
      }
    }

    // ── Facebook Page (Messenger + Page post comments)
    if (conn.scopes.includes("pages_messaging")) {
      for (const convo of await fb.listMessengerConversations(conn.pageId, token, 1)) {
        for (const m of convo.messages?.data ?? []) {
          const isEcho = m.from.id === conn.pageId;
          const customer = isEcho ? m.to?.data[0]?.id : m.from.id;
          if (customer) events.push(dmEvent("facebook", conn.pageId, customer, isEcho, m));
        }
      }
    }
    if (conn.scopes.includes("pages_read_user_content")) {
      for (const post of await fb.listRecentPostsWithComments(conn.pageId, token)) {
        for (const c of post.comments?.data ?? []) {
          events.push(fbCommentEvent(conn.pageId, post.id, c));
          for (const r of c.comments?.data ?? []) events.push(fbCommentEvent(conn.pageId, post.id, r, c.id));
        }
      }
    }

    // Oldest first so thread previews / lastInboundAt end up correct.
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (const e of events) {
      const r = await ingestEvent(conn, e);
      if (r) touched.add(r.threadId);
    }

    await db
      .update(metaConnections)
      .set({ lastSyncedAt: new Date(), lastError: null })
      .where(eq(metaConnections.id, conn.id));
  } catch (err) {
    const authFailed = err instanceof GraphError && err.isAuthError;
    await db
      .update(metaConnections)
      .set({ lastError: String((err as Error).message), ...(authFailed ? { status: "error" as const } : {}) })
      .where(eq(metaConnections.id, conn.id));
    throw err;
  }

  await draftThreadsAwaitingReply([...touched], opts.draftLimit ?? 20);
  return { threads: touched.size };
}

type AnyApiMessage = {
  id: string;
  created_time: string;
  message?: string;
  attachments?: { data: { image_data?: { url: string }; video_data?: { url: string }; file_url?: string }[] };
};

function dmEvent(
  channel: "instagram" | "facebook",
  accountId: string,
  customerId: string,
  isEcho: boolean,
  m: AnyApiMessage,
): NormalizedEvent {
  return {
    type: "dm",
    channel,
    accountId,
    customerId,
    mid: m.id,
    text: m.message ?? "",
    attachments: (m.attachments?.data ?? []).map((a) => ({
      type: a.image_data ? "image" : a.video_data ? "video" : "file",
      url: a.image_data?.url ?? a.video_data?.url ?? a.file_url,
    })),
    timestamp: new Date(m.created_time),
    isEcho,
  };
}

function igCommentEvent(accountId: string, mediaId: string, c: ig.IgComment, parentId?: string): NormalizedEvent {
  return {
    type: "comment",
    channel: "instagram",
    accountId,
    commentId: c.id,
    parentId,
    text: c.text,
    fromId: c.from?.id,
    fromUsername: c.from?.username ?? c.username,
    mediaId,
    timestamp: new Date(c.timestamp),
  };
}

function fbCommentEvent(pageId: string, postId: string, c: fb.FbComment, parentId?: string): NormalizedEvent {
  return {
    type: "comment",
    channel: "facebook",
    accountId: pageId,
    commentId: c.id,
    parentId,
    text: c.message,
    fromId: c.from?.id,
    fromName: c.from?.name,
    mediaId: postId,
    timestamp: new Date(c.created_time),
  };
}

/** Only draft for open threads whose latest message is from the customer and that have no pending draft. */
async function draftThreadsAwaitingReply(threadIds: string[], limit: number) {
  if (threadIds.length === 0) return;
  const open = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(inArray(threads.id, threadIds), eq(threads.status, "open")));
  const pending = new Set(
    (
      await db
        .select({ t: drafts.threadId })
        .from(drafts)
        .where(and(inArray(drafts.threadId, threadIds), eq(drafts.status, "pending")))
    ).map((r) => r.t),
  );
  let n = 0;
  for (const { id } of open) {
    if (n >= limit) break;
    if (pending.has(id)) continue;
    const [newest] = await db
      .select({ direction: messages.direction })
      .from(messages)
      .where(eq(messages.threadId, id))
      .orderBy(desc(messages.sentAt))
      .limit(1);
    if (newest?.direction !== "inbound") continue;
    await refreshDraftSafe(id);
    n++;
  }
}
