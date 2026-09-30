import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, threads } from "@/db/schema";
import { refreshDraftSafe } from "@/lib/inbox";

/**
 * Sample conversations so the inbox is usable (and demo-able) before a real
 * Instagram account is connected or Meta App Review is approved. Demo threads
 * are flagged `is_demo` and "sending" only records the reply locally.
 */
const SAMPLES: {
  channel?: "instagram" | "facebook";
  kind: "dm" | "comment";
  username: string;
  name?: string;
  caption?: string;
  minutesAgo: number;
  convo: { from: "them" | "us"; text: string; minutesAgo: number }[];
}[] = [
  {
    kind: "dm",
    username: "jess.makes.things",
    name: "Jess Ortega",
    minutesAgo: 4,
    convo: [{ from: "them", text: "Hi! Do you have any openings next Saturday? Looking to book for 2 people 🙏", minutesAgo: 4 }],
  },
  {
    kind: "comment",
    username: "coach_marcus",
    caption: "New drop is live! Limited run of 50 — link in bio ✨",
    minutesAgo: 12,
    convo: [{ from: "them", text: "Is this available in XL??", minutesAgo: 12 }],
  },
  {
    kind: "dm",
    username: "danielle.r",
    name: "Danielle R.",
    minutesAgo: 38,
    convo: [
      { from: "them", text: "Hey, my order #1042 still hasn't shipped and it's been 2 weeks. Kind of frustrated.", minutesAgo: 38 },
    ],
  },
  {
    kind: "comment",
    username: "sunnyside.studio",
    caption: "Behind the scenes of this week's shoot 📸",
    minutesAgo: 95,
    convo: [{ from: "them", text: "This is gorgeous, love your work!! 😍", minutesAgo: 95 }],
  },
  {
    kind: "dm",
    username: "brandpartnerships_ok",
    minutesAgo: 180,
    convo: [
      { from: "them", text: "Love your page! Would you be open to a paid collab with our skincare brand?", minutesAgo: 240 },
      { from: "us", text: "Hi! Thanks for thinking of us — can you share a bit more about what you have in mind?", minutesAgo: 200 },
      { from: "them", text: "Sure — 1 reel + 2 stories in November, budget around $600. Interested?", minutesAgo: 180 },
    ],
  },
  {
    channel: "facebook",
    kind: "dm",
    username: "",
    name: "Linda Park",
    minutesAgo: 22,
    convo: [{ from: "them", text: "Hi, are you open on Sunday? I'd like to stop by with my daughter.", minutesAgo: 22 }],
  },
  {
    channel: "facebook",
    kind: "comment",
    username: "",
    name: "Tom Becker",
    caption: "We're hiring! Part-time weekend help — message us for details.",
    minutesAgo: 140,
    convo: [{ from: "them", text: "Is this still open? I have retail experience.", minutesAgo: 140 }],
  },
  {
    kind: "comment",
    username: "cheap.followers.4u",
    caption: "New drop is live! Limited run of 50 — link in bio ✨",
    minutesAgo: 300,
    convo: [{ from: "them", text: "🔥 Get 10k followers FAST, DM us for promo 🔥", minutesAgo: 300 }],
  },
];

export async function seedDemoInbox(workspaceId: string, opts: { draft?: boolean } = {}) {
  const now = Date.now();
  const created: string[] = [];
  for (const [i, s] of SAMPLES.entries()) {
    const externalId = `demo_${s.kind}_${i}`;
    const lastInbound = s.convo.filter((c) => c.from === "them").at(-1);
    const [t] = await db
      .insert(threads)
      .values({
        workspaceId,
        kind: s.kind,
        channel: s.channel ?? "instagram",
        externalId,
        participantId: `demo_user_${i}`,
        participantUsername: s.username || null,
        participantName: s.name,
        mediaCaption: s.caption,
        lastMessageAt: new Date(now - s.minutesAgo * 60_000),
        lastInboundAt: lastInbound ? new Date(now - lastInbound.minutesAgo * 60_000) : null,
        lastMessagePreview: s.convo.at(-1)!.text,
        isDemo: true,
      })
      .onConflictDoNothing()
      .returning();
    if (!t) continue;
    await db.insert(messages).values(
      s.convo.map((c, j) => ({
        threadId: t.id,
        externalId: `${externalId}_m${j}`,
        direction: c.from === "them" ? ("inbound" as const) : ("outbound" as const),
        text: c.text,
        authorName: c.from === "them" ? s.username || s.name : "you",
        sentAt: new Date(now - c.minutesAgo * 60_000),
      })),
    );
    created.push(t.id);
  }
  if (opts.draft !== false) {
    await Promise.all(created.map((id) => refreshDraftSafe(id)));
  }
  return created.length;
}

export async function clearDemoInbox(workspaceId: string) {
  await db.delete(threads).where(and(eq(threads.workspaceId, workspaceId), eq(threads.isDemo, true)));
}
