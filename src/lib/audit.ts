import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(
  action: string,
  opts: { workspaceId?: string | null; userId?: string | null; detail?: Record<string, unknown> } = {},
) {
  await db.insert(auditLog).values({
    action,
    workspaceId: opts.workspaceId ?? null,
    userId: opts.userId ?? null,
    detail: opts.detail ?? {},
  });
}
