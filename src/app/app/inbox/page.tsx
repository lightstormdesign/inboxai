import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaConnections } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { listInbox } from "@/lib/inbox";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const { workspace } = await requireAuth();
  const [items, conns] = await Promise.all([
    listInbox(workspace.id, "open"),
    db.select({ id: metaConnections.id, status: metaConnections.status }).from(metaConnections).where(eq(metaConnections.workspaceId, workspace.id)),
  ]);
  return (
    <InboxView
      initialItems={JSON.parse(JSON.stringify(items))}
      hasConnection={conns.some((c) => c.status === "active")}
      hasBrokenConnection={conns.some((c) => c.status !== "active")}
    />
  );
}
