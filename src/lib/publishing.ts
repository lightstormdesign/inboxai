import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { metaConnections, postTargets, posts, type Post, type PostTarget } from "@/db/schema";
import { audit } from "@/lib/audit";
import * as buffer from "@/lib/buffer";
import { pageToken } from "@/lib/inbox";
import { GraphError } from "@/lib/meta/graph";
import * as pub from "@/lib/meta/publish";

export class PublishError extends Error {}

export type TargetInput =
  | { kind: "ig_feed" | "ig_story" | "ig_reel" | "fb_post"; connectionId: string }
  | { kind: "buffer"; bufferChannelId: string; label?: string };

export type CreatePostInput = {
  workspaceId: string;
  userId: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  /** Omit to publish now. */
  scheduledAt?: Date;
  targets: TargetInput[];
};

const LABELS: Record<Exclude<TargetInput["kind"], "buffer">, string> = {
  ig_feed: "Instagram post",
  ig_story: "Instagram story",
  ig_reel: "Instagram reel",
  fb_post: "Facebook post",
};

/** Validate against Meta's content rules up front so users get errors before scheduling. */
export function validatePost(input: Pick<CreatePostInput, "text" | "mediaUrl" | "mediaType" | "targets">) {
  if (input.targets.length === 0) throw new PublishError("Pick at least one place to post.");
  for (const t of input.targets) {
    if (t.kind.startsWith("ig_") && !input.mediaUrl) {
      throw new PublishError("Instagram posts, stories and reels need a photo or video.");
    }
    if (t.kind === "ig_reel" && input.mediaType !== "video") throw new PublishError("Reels need a video.");
    if (t.kind === "fb_post" && !input.text.trim() && !input.mediaUrl) {
      throw new PublishError("Facebook posts need text or media.");
    }
  }
  if (input.text.length > 2200) throw new PublishError("Captions are limited to 2,200 characters.");
}

export async function createPost(input: CreatePostInput) {
  validatePost(input);
  const connIds = input.targets.flatMap((t) => ("connectionId" in t ? [t.connectionId] : []));
  const conns = connIds.length
    ? await db
        .select()
        .from(metaConnections)
        .where(and(inArray(metaConnections.id, connIds), eq(metaConnections.workspaceId, input.workspaceId)))
    : [];
  const byId = new Map(conns.map((c) => [c.id, c]));

  const now = new Date();
  const scheduledAt = input.scheduledAt ?? now;
  const [post] = await db
    .insert(posts)
    .values({
      workspaceId: input.workspaceId,
      createdByUserId: input.userId,
      text: input.text,
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      scheduledAt,
    })
    .returning();

  await db.insert(postTargets).values(
    input.targets.map((t) => {
      if (t.kind === "buffer") {
        return { postId: post!.id, kind: t.kind, bufferChannelId: t.bufferChannelId, label: t.label ?? "Buffer" };
      }
      const conn = byId.get(t.connectionId);
      if (!conn) throw new PublishError("That account isn't connected to this workspace.");
      const handle = t.kind.startsWith("ig_") ? `@${conn.igUsername}` : conn.pageName;
      return { postId: post!.id, kind: t.kind, connectionId: conn.id, label: `${LABELS[t.kind]} · ${handle}` };
    }),
  );

  await audit(input.scheduledAt ? "post.scheduled" : "post.published", {
    workspaceId: input.workspaceId,
    userId: input.userId,
    detail: { postId: post!.id, targets: input.targets.map((t) => t.kind) },
  });

  // Buffer does its own scheduling, so hand those over immediately. Meta targets
  // publish now, or when the cron picks them up at `scheduledAt`.
  await processPost(post!.id, { onlyBuffer: Boolean(input.scheduledAt) });
  const [final] = await db.select().from(posts).where(eq(posts.id, post!.id));
  return final!;
}

/** Publish every pending target of a post (bounded work per call; safe to re-run). */
export async function processPost(postId: string, opts: { onlyBuffer?: boolean } = {}) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) return;
  const targets = await db
    .select()
    .from(postTargets)
    .where(and(eq(postTargets.postId, postId), inArray(postTargets.status, ["scheduled", "processing"])));

  for (const t of targets) {
    if (opts.onlyBuffer && t.kind !== "buffer") continue;
    await processTarget(post, t);
  }
  await rollupStatus(postId);
}

async function processTarget(post: Post, t: PostTarget) {
  const update = (v: Partial<PostTarget>) => db.update(postTargets).set(v).where(eq(postTargets.id, t.id));
  try {
    if (t.kind === "buffer") {
      const token = await buffer.getBufferToken(post.workspaceId);
      if (!token) throw new PublishError("Buffer is not connected.");
      const res = await buffer.createPost(token, {
        channelId: t.bufferChannelId!,
        text: post.text,
        dueAt: post.scheduledAt.getTime() > Date.now() + 60_000 ? post.scheduledAt : undefined,
        imageUrl: post.mediaType === "image" ? (post.mediaUrl ?? undefined) : undefined,
      });
      await update({ status: "published", externalId: res.id, publishedAt: new Date(), error: null });
      return;
    }

    const [conn] = await db.select().from(metaConnections).where(eq(metaConnections.id, t.connectionId!));
    if (!conn || conn.status !== "active") throw new PublishError("Account disconnected — reconnect it in Connections.");
    const token = pageToken(conn);

    if (t.kind === "fb_post") {
      const res = await pub.publishFacebookPost(conn.pageId, token, {
        text: post.text,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
      });
      await update({ status: "published", externalId: res.id, permalink: res.permalink, publishedAt: new Date(), error: null });
      return;
    }

    // Instagram: container → wait → publish. Video may take longer than one
    // request; we leave it "processing" and the cron finishes it later.
    if (!conn.igUserId) throw new PublishError("This Page has no linked Instagram account.");
    let containerId = t.containerId;
    if (!containerId) {
      containerId = await pub.createIgContainer(conn.igUserId, token, {
        kind: t.kind === "ig_story" ? "story" : t.kind === "ig_reel" ? "reel" : "feed",
        mediaUrl: post.mediaUrl!,
        mediaType: post.mediaType ?? "image",
        caption: post.text,
      });
      await update({ containerId, status: "processing", attempts: t.attempts + 1 });
    }
    const status = await pub.waitForIgContainer(containerId, token, post.mediaType === "video" ? 45_000 : 15_000);
    if (status === "IN_PROGRESS") return; // cron will retry
    if (status !== "FINISHED") throw new PublishError(`Instagram couldn't process the media (${status}).`);
    const media = await pub.publishIgContainer(conn.igUserId, token, containerId);
    await update({ status: "published", externalId: media.id, permalink: media.permalink, publishedAt: new Date(), error: null });
  } catch (err) {
    const message = err instanceof GraphError || err instanceof PublishError || err instanceof buffer.BufferError
      ? err.message
      : "Unexpected error";
    if (!(err instanceof PublishError)) console.error("[publish]", t.id, err);
    const retryable = err instanceof GraphError && err.isRateLimit && t.attempts < 3;
    await update({ status: retryable ? "scheduled" : "failed", error: message, attempts: t.attempts + 1 });
  }
}

async function rollupStatus(postId: string) {
  const ts = await db.select({ status: postTargets.status }).from(postTargets).where(eq(postTargets.postId, postId));
  const all = (s: string) => ts.every((t) => t.status === s);
  const some = (s: string) => ts.some((t) => t.status === s);
  const status: Post["status"] = all("published")
    ? "published"
    : all("failed")
      ? "failed"
      : some("scheduled") || some("processing")
        ? some("published") || some("processing")
          ? "publishing"
          : "scheduled"
        : "partial";
  await db.update(posts).set({ status }).where(eq(posts.id, postId));
}

/** Called by Vercel Cron: publish everything that's due, and finish processing videos. */
export async function processDuePosts(limit = 20) {
  const due = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(inArray(posts.status, ["scheduled", "publishing"]), lte(posts.scheduledAt, new Date())))
    .limit(limit);
  for (const p of due) await processPost(p.id);
  return due.length;
}

export async function cancelPost(workspaceId: string, postId: string) {
  await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId), eq(posts.status, "scheduled")));
}
