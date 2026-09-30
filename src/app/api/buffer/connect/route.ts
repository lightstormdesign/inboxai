import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authOrNull } from "@/lib/auth";
import { buildBufferAuthUrl, bufferOAuthConfigured, createPkce } from "@/lib/buffer";
import { encryptSecret, randomToken, signPayload } from "@/lib/crypto";
import { appUrl, env } from "@/lib/env";

/** "Connect with Buffer" → Buffer's consent screen (OAuth 2.0 + PKCE). */
export async function GET() {
  const ctx = await authOrNull();
  if (!ctx) return NextResponse.redirect(appUrl("/login"));
  if (!bufferOAuthConfigured()) {
    return NextResponse.redirect(appUrl("/app/settings/connections?error=buffer_not_configured"));
  }
  const { verifier, challenge } = createPkce();
  const nonce = randomToken(16);
  const state = signPayload(env().SESSION_SECRET, { w: ctx.workspace.id, u: ctx.user.id, n: nonce, t: Date.now() });
  // The PKCE verifier must survive the round-trip; keep it encrypted in a short-lived httpOnly cookie.
  (await cookies()).set("ib_buffer_pkce", encryptSecret(JSON.stringify({ v: verifier, n: nonce })), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/buffer",
    maxAge: 600,
  });
  return NextResponse.redirect(buildBufferAuthUrl(state, challenge));
}
