import { NextResponse, type NextRequest } from "next/server";
import { requireMeta } from "@/lib/env";
import { revokeMetaForFbUser } from "@/lib/compliance";
import { parseSignedRequest } from "@/lib/meta/signed-request";

/** Deauthorize Callback URL — Meta calls this when a user removes the app. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const data = parseSignedRequest(String(form.get("signed_request") ?? ""), requireMeta().appSecret);
  if (!data) return new NextResponse("Invalid signed_request", { status: 400 });
  await revokeMetaForFbUser(data.user_id);
  return NextResponse.json({ ok: true });
}
