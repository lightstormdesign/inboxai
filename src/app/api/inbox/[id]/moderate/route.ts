import { z } from "zod";
import { withAuth } from "@/lib/api";
import { moderateComment } from "@/lib/inbox";

const Body = z.object({ action: z.enum(["hide", "unhide", "delete"]) });

export const POST = withAuth<{ id: string }>(async (ctx, req, { id }) => {
  const { action } = Body.parse(await req.json());
  await moderateComment({ workspaceId: ctx.workspace.id, userId: ctx.user.id, threadId: id, action });
});
