import { withAuth } from "@/lib/api";
import { getThreadDetail } from "@/lib/inbox";

export const GET = withAuth<{ id: string }>(async (ctx, _req, { id }) => getThreadDetail(ctx.workspace.id, id));
