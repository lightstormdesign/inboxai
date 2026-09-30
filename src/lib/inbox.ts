import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  drafts,
  messages,
  metaConnections,
  threads,
  voiceProfiles,
  type MetaConnection,
  type Thread,
} from "@/db/schema";
import { generateDraft } from "@/lib/ai/draft";
import type { VoiceInput } from "@/lib/ai/prompt";
import { PROMPT_VERSION } from "@/lib/ai/prompt";
import { audit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { messagingWindow } from "@/lib/meta/window";
import { GraphError } from "@/lib/meta/graph";
import * as fb from "@/lib/meta/facebook";
import * as ig from "@/lib/meta/instagram";
import type { NormalizedEvent } from "@/lib/meta/webhooks";

export class InboxError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// ─── Voice ─────────────────────────────────────────────────────────────

export async function getVoice(workspaceId: string): Promise<VoiceInput> {
  const [v] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.workspaceId, workspaceId));
  return {
    businessName: v?.businessName ?? "",
    whatWeDo: v?.whatWeDo ?? "",
    audience: v?.audience ?? "",
    tone: v?.tone ?? "Friendly, warm, concise.",
    dos: v?.dos ?? "",
    donts: v?.donts ?? "",
    emojiStyle: v?.emojiStyle ?? "sparingly",
    signOff: v?.signOff ?? "",
    samples: v?.samples ?? [],
    faq: v?.faq ?? [],
    links: v?.links ?? "",
  };
}

export function pageToken(conn: MetaConnection): string {
  return decryptSecret(conn.pageAccessTokenEnc);
}

// ─── Ingest ────────────────────────────────────────────────────────────

async function upsertThread(values: typeof threads.$inferInsert): Promise<Thread> {
  const [row] = await db
    .insert(threads)
    .values(values)
    .onConflictDoUpdate({
      target: [threads.workspaceId, threads.channel, threads.kind, threads.externalId],
      set: {
        participantUsername: sql`coalesce(excluded.participant_username, ${threads.participantUsername})`,
        participantName: sql`coalesce(excluded.participant_name, ${threads.participantName})`,
        mediaCaption: sql`coalesce(excluded.media_caption, ${threads.mediaCaption})`,
        mediaPermalink: sql`coalesce(excluded.media_permalink, ${threads.mediaPermalink})`,
      },
    })
    .returning();
  return row!;
}

/** Insert a message; returns null if it already existed (webhook retries, echo of our own send). */
async function insertMessage(values: typeof messages.$inferInsert) {
  const [row] = await db.insert(messages).values(values).onConflictDoNothing().returning();
  return row ?? null;
}

async function touchThread(threadId: string, m: { direction: "inbound" | "outbound"; text: string; sentAt: Date }) {
  const preview = m.text.slice(0, 200) || "[attachment]";
  await db
    .update(threads)
    .set(
      m.direction === "inbound"
        ? {
            lastMessageAt: sql`greatest(${threads.lastMessageAt}, ${m.sentAt.toISOString()}::timestamptz)`,
            lastInboundAt: m.sentAt,
            lastMessagePreview: preview,
            unread: true,
            status: "open",
          }
        : { lastMessageAt: sql`greatest(${threads.lastMessageAt}, ${m.sentAt.toISOString()}::timestamptz)`, lastMessagePreview: preview },
    )
    .where(eq(threads.id, threadId));
}

export type IngestResult = { threadId: string; needsDraft: boolean } | null;

export async function ingestEvent(conn: MetaConnection, evt: NormalizedEvent): Promise<IngestResult> {
  return evt.type === "dm" ? ingestDm(conn, evt) : ingestComment(conn, evt);
}

/** Our own account id on this channel (for spotting our own echoes/replies). */
function ownAccountId(conn: MetaConnection, channel: NormalizedEvent["channel"]) {
  return channel === "instagram" ? conn.igUserId : conn.pageId;
}

function ownHandle(conn: MetaConnection, channel: NormalizedEvent["channel"]) {
  return channel === "instagram" ? conn.igUsername : conn.pageName;
}

async function lookupProfile(conn: MetaConnection, evt: Extract<NormalizedEvent, { type: "dm" }>) {
  try {
    if (evt.channel === "instagram") {
      const p = await ig.getIgUserProfile(evt.customerId, pageToken(conn));
      return { username: p.username, name: p.name };
    }
    const p = await fb.getPsidProfile(evt.customerId, pageToken(conn));
    return { username: undefined, name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" ") };
  } catch {
    // profile lookup is best-effort (user may have restricted it)
    return { username: undefined, name: undefined };
  }
}

async function ingestDm(conn: MetaConnection, evt: Extract<NormalizedEvent, { type: "dm" }>): Promise<IngestResult> {
  let profile: { username?: string; name?: string } = {};
  if (!evt.isEcho) {
    const [existing] = await db
      .select({ u: threads.participantUsername, n: threads.participantName })
      .from(threads)
      .where(
        and(
          eq(threads.workspaceId, conn.workspaceId),
          eq(threads.channel, evt.channel),
          eq(threads.kind, "dm"),
          eq(threads.externalId, evt.customerId),
        ),
      );
    if (!existing?.u && !existing?.n) profile = await lookupProfile(conn, evt);
  }

  const thread = await upsertThread({
    workspaceId: conn.workspaceId,
    connectionId: conn.id,
    channel: evt.channel,
    kind: "dm",
    externalId: evt.customerId,
    participantId: evt.customerId,
    participantUsername: profile.username,
    participantName: profile.name,
    lastMessageAt: evt.timestamp,
  });

  const msg = await insertMessage({
    threadId: thread.id,
    externalId: evt.mid,
    direction: evt.isEcho ? "outbound" : "inbound",
    text: evt.text,
    attachments: evt.attachments,
    authorName: evt.isEcho
      ? ownHandle(conn, evt.channel)
      : (profile.username ?? thread.participantUsername ?? profile.name ?? thread.participantName),
    sentAt: evt.timestamp,
  });
  if (!msg) return null;
  await touchThread(thread.id, msg);
  return { threadId: thread.id, needsDraft: msg.direction === "inbound" };
}

async function ingestComment(
  conn: MetaConnection,
  evt: Extract<NormalizedEvent, { type: "comment" }>,
): Promise<IngestResult> {
  const fromUs = Boolean(evt.fromId && evt.fromId === ownAccountId(conn, evt.channel));
  const rootId = evt.parentId ?? evt.commentId;

  // Our own top-level comment on our own post isn't an inbox item.
  if (fromUs && !evt.parentId) return null;

  let caption: string | undefined;
  let permalink: string | undefined;
  if (evt.mediaId && !evt.parentId) {
    try {
      if (evt.channel === "instagram") {
        const media = await ig.getMedia(evt.mediaId, pageToken(conn));
        caption = media.caption;
        permalink = media.permalink;
      } else {
        const post = await fb.getPost(evt.mediaId, pageToken(conn));
        caption = post.message;
        permalink = post.permalink_url;
      }
    } catch {
      // best-effort
    }
  }

  const thread = await upsertThread({
    workspaceId: conn.workspaceId,
    connectionId: conn.id,
    channel: evt.channel,
    kind: "comment",
    externalId: rootId,
    participantId: evt.parentId ? undefined : evt.fromId,
    participantUsername: evt.parentId ? undefined : evt.fromUsername,
    participantName: evt.parentId ? undefined : evt.fromName,
    mediaId: evt.mediaId,
    mediaCaption: caption,
    mediaPermalink: permalink,
    lastMessageAt: evt.timestamp,
  });

  const msg = await insertMessage({
    threadId: thread.id,
    externalId: evt.commentId,
    direction: fromUs ? "outbound" : "inbound",
    text: evt.text,
    authorName: evt.fromUsername ?? evt.fromName,
    sentAt: evt.timestamp,
  });
  if (!msg) return null;
  await touchThread(thread.id, msg);
  return { threadId: thread.id, needsDraft: msg.direction === "inbound" };
}

// ─── Drafting ──────────────────────────────────────────────────────────

/** (Re)generate the AI draft for a thread. Supersedes any pending draft. */
export async function refreshDraft(threadId: string) {
  const [thread] = await db.select().from(threads).where(eq(threads.id, threadId));
  if (!thread) throw new InboxError("Thread not found", 404);

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(desc(messages.sentAt))
    .limit(12);
  history.reverse();
  const lastInbound = [...history].reverse().find((m) => m.direction === "inbound");
  if (!lastInbound) return null;

  const voice = await getVoice(thread.workspaceId);
  const result = await generateDraft(voice, {
    kind: thread.kind,
    channel: thread.channel,
    customerHandle: thread.participantUsername,
    postCaption: thread.mediaCaption,
    history: history.map((m) => ({ direction: m.direction, text: m.text, author: m.authorName })),
  });

  return db.transaction(async (tx) => {
    await tx
      .update(drafts)
      .set({ status: "superseded" })
      .where(and(eq(drafts.threadId, threadId), eq(drafts.status, "pending")));
    const [draft] = await tx
      .insert(drafts)
      .values({
        threadId,
        replyToMessageId: lastInbound.id,
        text: result.reply,
        confidence: result.confidence,
        rationale: result.rationale,
        model: result.model,
        promptVersion: PROMPT_VERSION,
      })
      .returning();
    await tx
      .update(threads)
      .set({ intent: result.intent, needsAttention: result.needs_attention })
      .where(eq(threads.id, threadId));
    return draft!;
  });
}

/** Draft generation that never throws — used from webhooks/cron. */
export async function refreshDraftSafe(threadId: string) {
  try {
    await refreshDraft(threadId);
  } catch (err) {
    console.error("[draft] failed", threadId, err);
  }
}

// ─── Sending (human-approved only) ─────────────────────────────────────

async function loadOwnedThread(workspaceId: string, threadId: string) {
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.workspaceId, workspaceId)));
  if (!thread) throw new InboxError("Thread not found", 404);
  const conn = thread.connectionId
    ? (await db.select().from(metaConnections).where(eq(metaConnections.id, thread.connectionId)))[0]
    : undefined;
  return { thread, conn };
}

/**
 * The ONLY code path that publishes a reply to Meta. It requires an
 * authenticated user id — there is deliberately no automated caller.
 */
export async function sendReply(opts: {
  workspaceId: string;
  userId: string;
  threadId: string;
  text: string;
  draftId?: string;
  mode?: "public" | "private";
}) {
  const text = opts.text.trim();
  if (!text) throw new InboxError("Reply is empty");
  if (text.length > 1000) throw new InboxError("Reply is too long (1000 characters max)");

  const { thread, conn } = await loadOwnedThread(opts.workspaceId, opts.threadId);
  let externalId: string | null = null;

  if (!thread.isDemo) {
    if (!conn || conn.status !== "active") throw new InboxError("This account is disconnected — reconnect it in Settings.");
    const token = pageToken(conn);
    try {
      if (thread.kind === "dm") {
        const window = messagingWindow(thread.lastInboundAt);
        if (window === "closed") {
          throw new InboxError("Meta only allows replies within 7 days of the customer's last message.");
        }
        const res = await ig.sendDirectMessage(conn.pageId, token, thread.externalId, text, {
          humanAgentTag: window === "human_agent",
        });
        externalId = res.message_id;
      } else if (opts.mode === "private") {
        const res = await ig.sendPrivateReply(conn.pageId, token, thread.externalId, text);
        externalId = res.message_id;
      } else {
        const res =
          thread.channel === "facebook"
            ? await fb.replyToFbComment(thread.externalId, token, text)
            : await ig.replyToComment(thread.externalId, token, text);
        externalId = res.id;
      }
    } catch (err) {
      if (opts.draftId) {
        await db
          .update(drafts)
          .set({ status: "failed", error: String((err as Error).message) })
          .where(eq(drafts.id, opts.draftId));
      }
      if (err instanceof GraphError && err.isAuthError) {
        await db
          .update(metaConnections)
          .set({ status: "error", lastError: err.message })
          .where(eq(metaConnections.id, conn.id));
        throw new InboxError("Meta access expired — please reconnect in Settings.", 409);
      }
      if (err instanceof GraphError) {
        const platform = thread.channel === "facebook" ? "Facebook" : "Instagram";
        throw new InboxError(`${platform} rejected the reply: ${err.message}`, 502);
      }
      throw err;
    }
  }

  const now = new Date();
  const [msg] = await db
    .insert(messages)
    .values({
      threadId: thread.id,
      externalId,
      direction: "outbound",
      text,
      authorName: (thread.channel === "facebook" ? conn?.pageName : conn?.igUsername) ?? "you",
      sentAt: now,
      sentByUserId: opts.userId,
    })
    .onConflictDoNothing()
    .returning();

  if (opts.draftId) {
    await db
      .update(drafts)
      .set({ status: "sent", finalText: text, decidedByUserId: opts.userId, decidedAt: now })
      .where(and(eq(drafts.id, opts.draftId), eq(drafts.threadId, thread.id)));
  }
  await db
    .update(threads)
    .set({ status: "done", unread: false, lastMessageAt: now, lastMessagePreview: text.slice(0, 200) })
    .where(eq(threads.id, thread.id));

  await audit("reply.sent", {
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    detail: { threadId: thread.id, kind: thread.kind, mode: opts.mode ?? "public", draftId: opts.draftId },
  });
  return msg;
}

export async function discardDraft(workspaceId: string, userId: string, threadId: string, draftId: string) {
  await loadOwnedThread(workspaceId, threadId);
  await db
    .update(drafts)
    .set({ status: "discarded", decidedByUserId: userId, decidedAt: new Date() })
    .where(and(eq(drafts.id, draftId), eq(drafts.threadId, threadId)));
}

export async function moderateComment(opts: {
  workspaceId: string;
  userId: string;
  threadId: string;
  action: "hide" | "unhide" | "delete";
}) {
  const { thread, conn } = await loadOwnedThread(opts.workspaceId, opts.threadId);
  if (thread.kind !== "comment") throw new InboxError("Only comments can be moderated");
  if (!thread.isDemo) {
    if (!conn) throw new InboxError("Account disconnected");
    const token = pageToken(conn);
    const hide = opts.action === "hide";
    if (thread.channel === "facebook") {
      if (opts.action === "delete") await fb.deleteFbComment(thread.externalId, token);
      else await fb.setFbCommentHidden(thread.externalId, token, hide);
    } else {
      if (opts.action === "delete") await ig.deleteComment(thread.externalId, token);
      else await ig.setCommentHidden(thread.externalId, token, hide);
    }
  }
  await db
    .update(threads)
    .set({ status: opts.action === "unhide" ? "open" : "archived", unread: false })
    .where(eq(threads.id, thread.id));
  await audit(`comment.${opts.action}`, { workspaceId: opts.workspaceId, userId: opts.userId, detail: { threadId: thread.id } });
}

export async function setThreadStatus(workspaceId: string, threadId: string, status: "open" | "done" | "archived") {
  await loadOwnedThread(workspaceId, threadId);
  await db.update(threads).set({ status, unread: false }).where(eq(threads.id, threadId));
}

// ─── Queries for the UI ────────────────────────────────────────────────

export async function listInbox(workspaceId: string, filter: "open" | "done" | "archived" | "attention" = "open") {
  const where =
    filter === "attention"
      ? and(eq(threads.workspaceId, workspaceId), eq(threads.status, "open"), eq(threads.needsAttention, true))
      : and(eq(threads.workspaceId, workspaceId), eq(threads.status, filter));
  const rows = await db.select().from(threads).where(where).orderBy(desc(threads.lastMessageAt)).limit(200);
  if (rows.length === 0) return [];
  const pending = await db
    .select()
    .from(drafts)
    .where(and(inArray(drafts.threadId, rows.map((r) => r.id)), eq(drafts.status, "pending")));
  const byThread = new Map(pending.map((d) => [d.threadId, d]));
  return rows.map((t) => ({ thread: t, draft: byThread.get(t.id) ?? null }));
}

export async function getThreadDetail(workspaceId: string, threadId: string) {
  const { thread, conn } = await loadOwnedThread(workspaceId, threadId);
  const msgs = await db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(asc(messages.sentAt));
  const [draft] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.threadId, threadId), eq(drafts.status, "pending")))
    .orderBy(desc(drafts.createdAt))
    .limit(1);
  if (thread.unread) await db.update(threads).set({ unread: false }).where(eq(threads.id, threadId));
  return {
    thread,
    account: conn ? { igUsername: conn.igUsername, pageName: conn.pageName } : null,
    messages: msgs,
    draft: draft ?? null,
    window: thread.kind === "dm" && !thread.isDemo ? messagingWindow(thread.lastInboundAt) : null,
  };
}
