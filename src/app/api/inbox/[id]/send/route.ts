import { z } from "zod";
import { withAuth } from "@/lib/api";
import { sendReply } from "@/lib/inbox";

const Body = z.object({
  text: z.string().min(1).max(1000),
  draftId: z.string().uuid().optional(),
  mode: z.enum(["public", "private"]).optional(),
  /** Explicit human confirmation — the UI sets this only on the Send tap. */
  approved: z.literal(true),
});

export const POST = withAuth<{ id: string }>(async (ctx, req, { id }) => {
  const body = Body.parse(await req.json());
  const message = await sendReply({
    workspaceId: ctx.workspace.id,
    userId: ctx.user.id,
    threadId: id,
    text: body.text,
    draftId: body.draftId,
    mode: body.mode,
  });
  return { message };
});
