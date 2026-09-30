import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authOrNull } from "@/lib/auth";
import { randomToken, signPayload } from "@/lib/crypto";
import { appUrl, env, metaConfigured } from "@/lib/env";
import { buildLoginUrl } from "@/lib/meta/oauth";

/** Step 1 of Facebook Login for Business: redirect to Meta's dialog with a signed, cookie-bound state. */
export async function GET() {
  const ctx = await authOrNull();
  if (!ctx) return NextResponse.redirect(appUrl("/login"));
  if (!metaConfigured()) {
    return NextResponse.redirect(appUrl("/app/settings/connections?error=meta_not_configured"));
  }
  const nonce = randomToken(16);
  const state = signPayload(env().SESSION_SECRET, { w: ctx.workspace.id, u: ctx.user.id, n: nonce, t: Date.now() });
  (await cookies()).set("ib_meta_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/meta",
    maxAge: 600,
  });
  return NextResponse.redirect(buildLoginUrl(state));
}
