import { z } from "zod";
import { withAuth } from "@/lib/api";
import { setThreadStatus } from "@/lib/inbox";

const Body = z.object({ status: z.enum(["open", "done", "archived"]) });

export const POST = withAuth<{ id: string }>(async (ctx, req, { id }) => {
  const { status } = Body.parse(await req.json());
  await setThreadStatus(ctx.workspace.id, id, status);
});
