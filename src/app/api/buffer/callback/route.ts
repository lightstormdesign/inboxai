import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { bufferConnections } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authOrNull } from "@/lib/auth";
import { exchangeBufferCode, getOrganizations, tokenColumns } from "@/lib/buffer";
import { decryptSecret, safeEqual, verifyPayload } from "@/lib/crypto";
import { appUrl, env } from "@/lib/env";

type State = { w: string; u: string; n: string; t: number };

function back(query: string) {
  return NextResponse.redirect(appUrl(`/app/settings/connections?${query}`));
}

export async function GET(req: NextRequest) {
  const ctx = await authOrNull();
  if (!ctx) return NextResponse.redirect(appUrl("/login"));
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back(`error=buffer_${encodeURIComponent(params.get("error")!)}`);

  const jar = await cookies();
  const raw = jar.get("ib_buffer_pkce")?.value;
  jar.delete("ib_buffer_pkce");
  let pkce: { v: string; n: string } | null = null;
  try {
    pkce = raw ? JSON.parse(decryptSecret(raw)) : null;
  } catch {
    pkce = null;
  }
  const state = verifyPayload<State>(env().SESSION_SECRET, params.get("state") ?? "");
  if (
    !pkce ||
    !state ||
    !safeEqual(state.n, pkce.n) ||
    state.w !== ctx.workspace.id ||
    state.u !== ctx.user.id ||
    Date.now() - state.t > 10 * 60_000
  ) {
    return back("error=invalid_state");
  }
  const code = params.get("code");
  if (!code) return back("error=missing_code");

  try {
    const tokens = await exchangeBufferCode(code, pkce.v);
    const orgs = await getOrganizations(tokens.access_token);
    const values = {
      ...tokenColumns(tokens),
      organizationId: orgs[0]?.id ?? null,
      organizationName: orgs[0]?.name ?? null,
    };
    await db
      .insert(bufferConnections)
      .values({ workspaceId: ctx.workspace.id, ...values })
      .onConflictDoUpdate({ target: bufferConnections.workspaceId, set: values });
    await audit("buffer.connected", { workspaceId: ctx.workspace.id, userId: ctx.user.id, detail: { via: "oauth" } });
    return back("buffer=connected");
  } catch (err) {
    console.error("[buffer callback]", err);
    return back(`error=${encodeURIComponent((err as Error).message.slice(0, 120))}`);
  }
}
