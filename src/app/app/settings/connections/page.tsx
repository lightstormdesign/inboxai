import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bufferConnections, metaConnections } from "@/db/schema";
import { clearDemoAction, disconnectBufferAction, disconnectMetaAction, seedDemoAction, syncNowAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { bufferOAuthConfigured } from "@/lib/buffer";
import { metaConfigured } from "@/lib/env";
import { BufferConnectForm } from "./buffer-form";

export const metadata: Metadata = { title: "Connections" };

const ERRORS: Record<string, string> = {
  meta_not_configured: "Meta app credentials aren't configured on the server yet (META_APP_ID / META_APP_SECRET).",
  no_pages:
    "No Facebook Pages were shared. Run Continue with Facebook again and select at least one Page (and its linked Instagram account).",
  buffer_not_configured: "Buffer sign-in isn't configured on the server yet (BUFFER_CLIENT_ID).",
  buffer_access_denied: "You cancelled the Buffer sign-in.",
  invalid_state: "The login session expired or didn't match. Please try connecting again.",
  user_denied: "You cancelled the Facebook login.",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; onboarding?: string; buffer?: string }>;
}) {
  const { workspace } = await requireAuth();
  const sp = await searchParams;
  const [metas, [buf]] = await Promise.all([
    db.select().from(metaConnections).where(eq(metaConnections.workspaceId, workspace.id)),
    db.select().from(bufferConnections).where(eq(bufferConnections.workspaceId, workspace.id)),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        {sp.onboarding && <p className="text-sm font-medium text-brand-600">Step 2 of 2 · Connect your accounts</p>}
        <h1 className="text-2xl font-semibold">Connections</h1>
      </div>

      {sp.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ERRORS[sp.error] ?? `Connection failed: ${sp.error}`}</p>
      )}
      {sp.buffer === "connected" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Buffer connected. <Link href="/app/publish" className="underline">Go to Publish →</Link>
        </p>
      )}
      {sp.connected && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Connected {sp.connected} account(s). We&apos;re pulling in your recent messages and comments now.{" "}
          <Link href="/app/inbox" className="underline">Go to inbox →</Link>
        </p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Instagram &amp; Facebook</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Connect your Facebook Page and its linked Instagram professional (Business or Creator) account. You&apos;ll
          log in with Facebook and choose exactly which Pages and Instagram accounts to share. We use this to show your
          DMs and comments here, post the replies you approve, and publish the posts you create — nothing is sent or
          posted without you pressing the button.
        </p>

        <ul className="mt-4 space-y-3">
          {metas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 p-3">
              {c.igProfilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.igProfilePictureUrl} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-zinc-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.pageName}
                  {c.igUsername && <span className="font-normal text-zinc-500"> · Instagram @{c.igUsername}</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {c.igUsername ? "Facebook + Instagram" : "Facebook only (no linked Instagram)"} · {c.status === "active" ? "Active" : c.status === "revoked" ? "Access removed" : "Needs reconnect"}
                  {c.lastSyncedAt && ` · synced ${c.lastSyncedAt.toLocaleString()}`}
                </p>
                {c.lastError && <p className="mt-1 text-xs text-amber-700">{c.lastError}</p>}
              </div>
              {c.status === "active" ? (
                <form action={syncNowAction}>
                  <input type="hidden" name="connectionId" value={c.id} />
                  <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">Sync now</button>
                </form>
              ) : (
                <a href="/api/meta/connect" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs text-white">Reconnect</a>
              )}
              <form action={disconnectMetaAction}>
                <input type="hidden" name="connectionId" value={c.id} />
                <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">
                  Disconnect &amp; delete data
                </button>
              </form>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          {metaConfigured() ? (
            <a
              href="/api/meta/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Continue with Facebook
            </a>
          ) : (
            <p className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
              Meta app not configured on this deployment. Set META_APP_ID and META_APP_SECRET — see docs/meta-app-review/01-app-setup.md.
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-zinc-100 pt-4 text-sm">
          <p className="text-zinc-600">Not ready to connect yet? Try the inbox with sample conversations.</p>
          <div className="mt-2 flex gap-2">
            <form action={seedDemoAction}>
              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">Load sample conversations</button>
            </form>
            <form action={clearDemoAction}>
              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">Remove samples</button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Buffer <span className="text-xs font-normal text-zinc-500">(post scheduling)</span></h2>
        <p className="mt-1 text-sm text-zinc-600">
          Optional. Instagram and Facebook publishing is built in — connect Buffer only if you already use it or want
          to post to other networks (TikTok, LinkedIn, …) from here.
        </p>
        {buf ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              Connected{buf.organizationName ? ` to ${buf.organizationName}` : ""}
              {buf.authType === "api_key" ? " (API key)" : ""}.
            </p>
            <form action={disconnectBufferAction}>
              <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">Disconnect</button>
            </form>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {bufferOAuthConfigured() && (
              <a
                href="/api/buffer/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Connect with Buffer
              </a>
            )}
            <details className="text-sm" open={!bufferOAuthConfigured()}>
              <summary className="cursor-pointer text-zinc-500">Use a Buffer API key instead</summary>
              <BufferConnectForm />
            </details>
          </div>
        )}
      </section>

      {sp.onboarding && (
        <Link href="/app/inbox" className="block rounded-lg bg-zinc-900 px-4 py-2 text-center font-medium text-white">
          Go to my inbox →
        </Link>
      )}
    </div>
  );
}
