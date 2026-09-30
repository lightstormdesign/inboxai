import { z } from "zod";
import { withAuth } from "@/lib/api";
import { listInbox } from "@/lib/inbox";

const Filter = z.enum(["open", "done", "archived", "attention"]).catch("open");

export const GET = withAuth<object>(async (ctx, req) => {
  const filter = Filter.parse(new URL(req.url).searchParams.get("filter"));
  return { items: await listInbox(ctx.workspace.id, filter) };
});
