import { NextResponse, type NextRequest } from "next/server";
import { appUrl, requireMeta } from "@/lib/env";
import { createDeletionRequest } from "@/lib/compliance";
import { parseSignedRequest } from "@/lib/meta/signed-request";

/**
 * Data Deletion Request Callback URL. Must return JSON with a status URL
 * and a confirmation code the user can use to track the request.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const data = parseSignedRequest(String(form.get("signed_request") ?? ""), requireMeta().appSecret);
  if (!data) return new NextResponse("Invalid signed_request", { status: 400 });
  const code = await createDeletionRequest(data.user_id, "meta_callback");
  return NextResponse.json({
    url: appUrl(`/data-deletion/status?code=${encodeURIComponent(code)}`),
    confirmation_code: code,
  });
}
