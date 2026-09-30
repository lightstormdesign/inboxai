import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authOrNull, type AuthContext } from "@/lib/auth";
import { InboxError } from "@/lib/inbox";

/** Wrap an authenticated JSON route handler with consistent error handling. */
export function withAuth<P>(
  handler: (ctx: AuthContext, req: Request, params: P) => Promise<unknown>,
) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const ctx = await authOrNull();
    if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    try {
      const data = await handler(ctx, req, await route.params);
      return NextResponse.json(data ?? { ok: true });
    } catch (err) {
      if (err instanceof InboxError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      console.error(err);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
