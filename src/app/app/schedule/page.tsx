import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bufferConnections, scheduledPosts } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import * as buffer from "@/lib/buffer";
import { decryptSecret } from "@/lib/crypto";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "Schedule posts" };

export default async function SchedulePage() {
  const { workspace } = await requireAuth();
  const [conn] = await db.select().from(bufferConnections).where(eq(bufferConnections.workspaceId, workspace.id));

  if (!conn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Schedule posts</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Connect your Buffer account to queue and schedule posts to Instagram and your other channels.
        </p>
        <Link href="/app/settings/connections" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          Connect Buffer
        </Link>
      </div>
    );
  }

  let channels: buffer.BufferChannel[] = [];
  let loadError: string | null = null;
  try {
    if (conn.organizationId) channels = await buffer.getChannels(decryptSecret(conn.apiKeyEnc), conn.organizationId);
  } catch (err) {
    loadError = (err as Error).message;
  }

  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.workspaceId, workspace.id))
    .orderBy(desc(scheduledPosts.createdAt))
    .limit(30);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Schedule posts</h1>
        <p className="mt-1 text-sm text-zinc-600">Posts are created in your Buffer account{conn.organizationName ? ` (${conn.organizationName})` : ""}.</p>
      </div>
      {loadError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn&apos;t load Buffer channels: {loadError}</p>}
      <ComposeForm channels={channels.map((c) => ({ id: c.id, label: `${c.name} (${c.service})` }))} />
      <section>
        <h2 className="mb-2 font-semibold">Recently scheduled</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {posts.map((p) => (
              <li key={p.id} className="p-4 text-sm">
                <p className="text-xs text-zinc-500">
                  {p.channelLabel ?? p.bufferChannelId} · {p.dueAt ? p.dueAt.toLocaleString() : "Queued"}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{p.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
