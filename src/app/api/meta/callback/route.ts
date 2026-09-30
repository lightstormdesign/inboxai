import { NextResponse, after, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaConnections } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authOrNull } from "@/lib/auth";
import { encryptSecret, safeEqual, verifyPayload } from "@/lib/crypto";
import { appUrl, env } from "@/lib/env";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getGrantedScopes,
  getMe,
  listPages,
  subscribePageToApp,
} from "@/lib/meta/oauth";
import { syncConnection } from "@/lib/sync";

type State = { w: string; u: string; n: string; t: number };

function back(query: string) {
  return NextResponse.redirect(appUrl(`/app/settings/connections?${query}`));
}

/** Step 2: exchange the code, store encrypted Page tokens, subscribe webhooks, kick off a backfill. */
export async function GET(req: NextRequest) {
  const ctx = await authOrNull();
  if (!ctx) return NextResponse.redirect(appUrl("/login"));

  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    return back(`error=${encodeURIComponent(params.get("error_reason") ?? "denied")}`);
  }

  const jar = await cookies();
  const nonce = jar.get("ib_meta_nonce")?.value;
  jar.delete("ib_meta_nonce");
  const state = verifyPayload<State>(env().SESSION_SECRET, params.get("state") ?? "");
  if (
    !state ||
    !nonce ||
    !safeEqual(state.n, nonce) ||
    state.w !== ctx.workspace.id ||
    state.u !== ctx.user.id ||
    Date.now() - state.t > 10 * 60_000
  ) {
    return back("error=invalid_state");
  }

  const code = params.get("code");
  if (!code) return back("error=missing_code");

  try {
    const shortLived = await exchangeCodeForToken(code);
    const { token: userToken } = await exchangeForLongLivedToken(shortLived);
    const [me, scopes, pages] = await Promise.all([getMe(userToken), getGrantedScopes(userToken), listPages(userToken)]);

    if (pages.length === 0) return back("error=no_pages");

    const connectedIds: string[] = [];
    for (const page of pages) {
      // A Page may or may not have a linked Instagram professional account.
      const igAcct = page.instagram_business_account ?? { id: null, username: null, profile_picture_url: null };
      const [row] = await db
        .insert(metaConnections)
        .values({
          workspaceId: ctx.workspace.id,
          connectedByUserId: ctx.user.id,
          fbUserId: me.id,
          pageId: page.id,
          pageName: page.name,
          igUserId: igAcct.id,
          igUsername: igAcct.username,
          igProfilePictureUrl: igAcct.profile_picture_url,
          pageAccessTokenEnc: encryptSecret(page.access_token),
          scopes,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [metaConnections.workspaceId, metaConnections.pageId],
          set: {
            fbUserId: me.id,
            pageName: page.name,
            igUserId: igAcct.id,
            igUsername: igAcct.username,
            igProfilePictureUrl: igAcct.profile_picture_url,
            pageAccessTokenEnc: encryptSecret(page.access_token),
            scopes,
            status: "active",
            lastError: null,
          },
        })
        .returning();
      try {
        await subscribePageToApp(page.id, page.access_token);
      } catch (err) {
        await db
          .update(metaConnections)
          .set({ lastError: `Webhook subscription failed: ${(err as Error).message}` })
          .where(eq(metaConnections.id, row!.id));
      }
      connectedIds.push(row!.id);
    }

    await audit("meta.connected", {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      detail: { pages: pages.map((p) => p.id), scopes },
    });

    // Backfill recent DMs/comments after responding so the redirect is instant.
    after(async () => {
      for (const id of connectedIds) {
        const [conn] = await db.select().from(metaConnections).where(eq(metaConnections.id, id));
        if (conn) await syncConnection(conn, { draftLimit: 15 }).catch((e) => console.error("[backfill]", e));
      }
    });

    return back(`connected=${pages.length}`);
  } catch (err) {
    console.error("[meta callback]", err);
    return back(`error=${encodeURIComponent((err as Error).message.slice(0, 120))}`);
  }
}
