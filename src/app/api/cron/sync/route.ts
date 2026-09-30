import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaConnections } from "@/db/schema";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { purgeOldWebhookEvents } from "@/lib/compliance";
import { syncConnection } from "@/lib/sync";

export const maxDuration = 300;

/** Vercel Cron (see vercel.json): safety-net sync for missed webhooks + retention cleanup. */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const conns = await db.select().from(metaConnections).where(eq(metaConnections.status, "active"));
  const results: Record<string, unknown> = {};
  for (const conn of conns) {
    try {
      results[conn.id] = await syncConnection(conn, { draftLimit: 10 });
    } catch (err) {
      results[conn.id] = { error: (err as Error).message };
    }
  }
  await purgeOldWebhookEvents();
  return NextResponse.json({ synced: conns.length, results });
}
