import { z } from "zod";
import { withAuth } from "@/lib/api";
import { discardDraft, getThreadDetail, refreshDraft } from "@/lib/inbox";

/** Regenerate the AI draft (e.g. after editing the voice profile). */
export const POST = withAuth<{ id: string }>(async (ctx, _req, { id }) => {
  await getThreadDetail(ctx.workspace.id, id); // ownership check
  return { draft: await refreshDraft(id) };
});

const Discard = z.object({ draftId: z.string().uuid() });

export const DELETE = withAuth<{ id: string }>(async (ctx, req, { id }) => {
  const { draftId } = Discard.parse(await req.json());
  await discardDraft(ctx.workspace.id, ctx.user.id, id, draftId);
});
