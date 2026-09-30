import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bufferConnections, metaConnections, postTargets, posts } from "@/db/schema";
import { cancelPostAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import * as buffer from "@/lib/buffer";
import { env } from "@/lib/env";
import { Composer, type TargetOption } from "./composer";

export const metadata: Metadata = { title: "Publish" };

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800",
  scheduled: "bg-sky-100 text-sky-800",
  processing: "bg-amber-100 text-amber-800",
  publishing: "bg-amber-100 text-amber-800",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

export default async function PublishPage() {
  const { workspace } = await requireAuth();
  const [conns, [buf]] = await Promise.all([
    db.select().from(metaConnections).where(eq(metaConnections.workspaceId, workspace.id)),
    db.select().from(bufferConnections).where(eq(bufferConnections.workspaceId, workspace.id)),
  ]);

  const options: TargetOption[] = [];
  for (const c of conns.filter((c) => c.status === "active")) {
    if (c.igUserId && c.scopes.includes("instagram_content_publish")) {
      options.push({ key: `ig_feed:${c.id}`, group: `Instagram @${c.igUsername}`, label: "Post", target: { kind: "ig_feed", connectionId: c.id }, needsMedia: true });
      options.push({ key: `ig_story:${c.id}`, group: `Instagram @${c.igUsername}`, label: "Story", target: { kind: "ig_story", connectionId: c.id }, needsMedia: true });
      options.push({ key: `ig_reel:${c.id}`, group: `Instagram @${c.igUsername}`, label: "Reel", target: { kind: "ig_reel", connectionId: c.id }, needsVideo: true });
    }
    if (c.scopes.includes("pages_manage_posts")) {
      options.push({ key: `fb_post:${c.id}`, group: `Facebook · ${c.pageName}`, label: "Page post", target: { kind: "fb_post", connectionId: c.id } });
    }
  }

  let bufferError: string | null = null;
  if (buf?.organizationId) {
    try {
      const token = await buffer.getBufferToken(workspace.id);
      for (const ch of token ? await buffer.getChannels(token, buf.organizationId) : []) {
        const label = `${ch.name} (${ch.service})`;
        options.push({ key: `buffer:${ch.id}`, group: "Via Buffer", label, target: { kind: "buffer", bufferChannelId: ch.id, label: `Buffer · ${label}` } });
      }
    } catch (err) {
      bufferError = (err as Error).message;
    }
  }

  const recent = await db
    .select()
    .from(posts)
    .where(eq(posts.workspaceId, workspace.id))
    .orderBy(desc(posts.scheduledAt))
    .limit(30);
  const targets = recent.length
    ? await db.select().from(postTargets).where(inArray(postTargets.postId, recent.map((p) => p.id)))
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Publish</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Post or schedule to Instagram (feed, stories, reels) and your Facebook Page, straight from here.
        </p>
      </div>

      {options.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
          Connect an Instagram or Facebook account to start publishing.{" "}
          <Link href="/app/settings/connections" className="text-brand-600 underline">Go to Connections →</Link>
        </div>
      ) : (
        <Composer options={options} uploadsEnabled={Boolean(env().BLOB_READ_WRITE_TOKEN)} workspaceId={workspace.id} />
      )}
      {bufferError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Couldn&apos;t load Buffer channels: {bufferError}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Scheduled &amp; recent</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {recent.map((p) => (
              <li key={p.id} className="flex gap-3 p-4 text-sm">
                {p.mediaUrl && p.mediaType === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mediaUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{p.scheduledAt.toLocaleString()}</span>
                    <span className={`rounded px-1.5 py-0.5 ${STATUS_STYLE[p.status] ?? ""}`}>{p.status}</span>
                    {p.status === "scheduled" && (
                      <form action={cancelPostAction} className="ml-auto">
                        <input type="hidden" name="postId" value={p.id} />
                        <button className="text-red-600 hover:underline">Cancel</button>
                      </form>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap">{p.text || <em className="text-zinc-400">No caption</em>}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {targets.filter((t) => t.postId === p.id).map((t) => (
                      <li key={t.id} className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_STYLE[t.status] ?? "bg-zinc-100"}`} title={t.error ?? undefined}>
                        {t.permalink ? <a href={t.permalink} target="_blank" rel="noreferrer">{t.label} ↗</a> : t.label}
                        {t.status === "failed" && " ✕"}
                      </li>
                    ))}
                  </ul>
                  {targets.filter((t) => t.postId === p.id && t.error).map((t) => (
                    <p key={t.id} className="mt-1 text-xs text-red-700">{t.label}: {t.error}</p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
