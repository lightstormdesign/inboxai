import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { processDuePosts } from "@/lib/publishing";

export const maxDuration = 300;

/** Vercel Cron: publish scheduled posts that are due and finish processing videos. */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json({ processed: await processDuePosts() });
}
