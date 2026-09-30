import { NextResponse, after, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { metaConnections, webhookEvents } from "@/db/schema";
import { env, requireMeta } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { ingestEvent, refreshDraftSafe } from "@/lib/inbox";
import { parseMetaWebhook, verifyWebhookSignature, type WebhookPayload } from "@/lib/meta/webhooks";

export const maxDuration = 60;

/** Webhook verification handshake (Meta dashboard → Webhooks → Verify and save). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = env().META_WEBHOOK_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && expected && safeEqual(p.get("hub.verify_token") ?? "", expected)) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Event delivery. Verify signature, persist, ACK fast (Meta retries on slow
 * responses), then ingest + draft in `after()`. Drafting never sends anything.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const { appSecret } = requireMeta();
  if (!verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: { object?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const [stored] = await db
    .insert(webhookEvents)
    .values({ object: String(payload.object ?? "unknown"), payload })
    .returning({ id: webhookEvents.id });

  after(async () => {
    try {
      const events = parseMetaWebhook(payload as WebhookPayload);
      const toDraft = new Set<string>();
      for (const evt of events) {
        const conns = await db
          .select()
          .from(metaConnections)
          .where(
            and(
              evt.channel === "instagram"
                ? eq(metaConnections.igUserId, evt.accountId)
                : eq(metaConnections.pageId, evt.accountId),
              eq(metaConnections.status, "active"),
            ),
          );
        for (const conn of conns) {
          const res = await ingestEvent(conn, evt);
          if (res?.needsDraft) toDraft.add(res.threadId);
        }
      }
      for (const id of toDraft) await refreshDraftSafe(id);
      await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, stored!.id));
    } catch (err) {
      console.error("[webhook]", err);
      await db
        .update(webhookEvents)
        .set({ error: String((err as Error).message) })
        .where(eq(webhookEvents.id, stored!.id));
    }
  });

  return NextResponse.json({ ok: true });
}
