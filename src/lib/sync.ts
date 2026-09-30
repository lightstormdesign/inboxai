import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { drafts, metaConnections, messages, threads, type MetaConnection } from "@/db/schema";
import { GraphError } from "@/lib/meta/graph";
import * as ig from "@/lib/meta/instagram";
import type { NormalizedEvent } from "@/lib/meta/webhooks";
import { ingestEvent, pageToken, refreshDraftSafe } from "@/lib/inbox";

/**
 * Pull-based sync. Webhooks are the primary feed; this backfills on first
 * connect and runs from Vercel Cron as a safety net for missed deliveries.
 */
export async function syncConnection(conn: MetaConnection, opts: { draftLimit?: number } = {}) {
  if (!conn.igUserId || conn.status !== "active") return { threads: 0 };
  const token = pageToken(conn);
  const touched = new Set<string>();

  try {
    const events: NormalizedEvent[] = [];

    for (const convo of await ig.listConversations(conn.pageId, token, 1)) {
      for (const m of convo.messages?.data ?? []) {
        const isEcho = m.from.id === conn.igUserId;
        const customer = isEcho ? m.to?.data[0]?.id : m.from.id;
        if (!customer) continue;
        events.push({
          type: "dm",
          accountId: conn.igUserId,
          customerId: customer,
          mid: m.id,
          text: m.message ?? "",
          attachments: (m.attachments?.data ?? []).map((a) => ({
            type: a.image_data ? "image" : a.video_data ? "video" : "file",
            url: a.image_data?.url ?? a.video_data?.url ?? a.file_url,
          })),
          timestamp: new Date(m.created_time),
          isEcho,
        });
      }
    }

    for (const media of await ig.listRecentMediaWithComments(conn.igUserId, token)) {
      for (const c of media.comments?.data ?? []) {
        events.push(commentEvent(conn.igUserId, media.id, c));
        for (const r of c.replies?.data ?? []) events.push(commentEvent(conn.igUserId, media.id, r, c.id));
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

function commentEvent(accountId: string, mediaId: string, c: ig.IgComment, parentId?: string): NormalizedEvent {
  return {
    type: "comment",
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
