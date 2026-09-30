import "server-only";
import { eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { dataDeletionRequests, metaConnections, threads, webhookEvents, workspaces } from "@/db/schema";
import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";

/**
 * Delete everything we hold that came from Meta for a given Facebook user:
 * their Page connections (encrypted tokens) and every thread/message/draft
 * synced through them (cascades via FKs).
 */
export async function deleteMetaDataForFbUser(fbUserId: string) {
  const conns = await db
    .select({ id: metaConnections.id, workspaceId: metaConnections.workspaceId })
    .from(metaConnections)
    .where(eq(metaConnections.fbUserId, fbUserId));
  if (conns.length) {
    const ids = conns.map((c) => c.id);
    await db.delete(threads).where(inArray(threads.connectionId, ids));
    await db.delete(metaConnections).where(inArray(metaConnections.id, ids));
  }
  for (const c of conns) await audit("meta.data_deleted", { workspaceId: c.workspaceId, detail: { connectionId: c.id } });
  return conns.length;
}

export async function createDeletionRequest(fbUserId: string, source: "meta_callback" | "user_request") {
  const confirmationCode = randomToken(12);
  const [row] = await db
    .insert(dataDeletionRequests)
    .values({ confirmationCode, fbUserId, source })
    .returning();
  try {
    const n = await deleteMetaDataForFbUser(fbUserId);
    await db
      .update(dataDeletionRequests)
      .set({ status: "completed", completedAt: new Date(), detail: `Removed ${n} connected account(s) and all synced messages.` })
      .where(eq(dataDeletionRequests.id, row!.id));
  } catch (err) {
    await db
      .update(dataDeletionRequests)
      .set({ status: "failed", detail: String((err as Error).message) })
      .where(eq(dataDeletionRequests.id, row!.id));
  }
  return confirmationCode;
}

/** App removed by the user on Facebook: stop using their tokens immediately. */
export async function revokeMetaForFbUser(fbUserId: string) {
  const rows = await db
    .update(metaConnections)
    .set({ status: "revoked", pageAccessTokenEnc: "", lastError: "App access removed on Facebook" })
    .where(eq(metaConnections.fbUserId, fbUserId))
    .returning({ workspaceId: metaConnections.workspaceId });
  for (const r of rows) await audit("meta.deauthorized", { workspaceId: r.workspaceId, detail: { fbUserId } });
  return rows.length;
}

/** Full account deletion from Settings (owner only). */
export async function deleteWorkspace(workspaceId: string) {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

/** Retention: raw webhook payloads are debugging data only. */
export async function purgeOldWebhookEvents(days = 14) {
  await db.delete(webhookEvents).where(lt(webhookEvents.receivedAt, new Date(Date.now() - days * 86_400_000)));
}
