import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { memberships, sessions, users, workspaces } from "@/db/schema";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "ib_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
});

export type AuthContext = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  workspace: typeof workspaces.$inferSelect;
  role: "owner" | "admin" | "member";
};

/** v1: one workspace per user (created at signup). Multi-workspace switching can come later. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = await db
    .select({ workspace: workspaces, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, user.id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { user, workspace: row.workspace, role: row.role };
});

/** For pages / server actions: redirect to /login when signed out. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For route handlers: returns null instead of redirecting. */
export async function authOrNull(): Promise<AuthContext | null> {
  return getAuthContext();
}
