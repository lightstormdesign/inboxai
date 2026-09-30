"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  bufferConnections,
  memberships,
  metaConnections,
  scheduledPosts,
  users,
  voiceProfiles,
  workspaces,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, destroySession, requireAuth } from "@/lib/auth";
import * as buffer from "@/lib/buffer";
import { deleteWorkspace } from "@/lib/compliance";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "@/lib/crypto";
import { clearDemoInbox, seedDemoInbox } from "@/lib/demo";
import { env } from "@/lib/env";
import { pageToken } from "@/lib/inbox";
import { unsubscribePageFromApp } from "@/lib/meta/oauth";
import { syncConnection } from "@/lib/sync";

export type FormState = { error?: string; ok?: string } | undefined;

// ─── Auth ──────────────────────────────────────────────────────────────

const Signup = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  business: z.string().trim().min(1, "Enter your business name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  if (env().SIGNUPS_OPEN !== "true") return { error: "Signups are currently closed — join the waitlist." };
  const parsed = Signup.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, business, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: "An account with that email already exists." };

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, name, passwordHash: await hashPassword(password) }).returning();
    const [ws] = await tx.insert(workspaces).values({ name: business }).returning();
    await tx.insert(memberships).values({ workspaceId: ws!.id, userId: user!.id, role: "owner" });
    await tx.insert(voiceProfiles).values({ workspaceId: ws!.id, businessName: business });
    return user!.id;
  });
  await createSession(userId);
  redirect("/app/onboarding");
}

const Login = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Login.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password." };
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  redirect("/app/inbox");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ─── Voice profile ─────────────────────────────────────────────────────

const Voice = z.object({
  businessName: z.string().trim().max(120),
  whatWeDo: z.string().trim().max(2000),
  audience: z.string().trim().max(1000),
  tone: z.string().trim().max(1000),
  dos: z.string().trim().max(2000),
  donts: z.string().trim().max(2000),
  emojiStyle: z.string().trim().max(200),
  signOff: z.string().trim().max(200),
  links: z.string().trim().max(1000),
  samples: z.string().max(10000),
  faq: z.string().max(10000),
  next: z.string().optional(),
});

/** FAQ textarea format: "Q: …" / "A: …" blocks separated by blank lines. */
function parseFaq(raw: string) {
  return raw
    .split(/\n\s*\n/)
    .map((block) => {
      const q = block.match(/^\s*Q:\s*([\s\S]*?)(?=\n\s*A:|$)/i)?.[1]?.trim() ?? "";
      const a = block.match(/\n\s*A:\s*([\s\S]*)$/i)?.[1]?.trim() ?? "";
      return { q, a };
    })
    .filter((f) => f.q && f.a)
    .slice(0, 50);
}

export async function saveVoiceAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAuth();
  const parsed = Voice.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { samples, faq, next, ...rest } = parsed.data;
  const values = {
    ...rest,
    samples: samples.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    faq: parseFaq(faq),
    updatedAt: new Date(),
  };
  await db
    .insert(voiceProfiles)
    .values({ workspaceId: ctx.workspace.id, ...values })
    .onConflictDoUpdate({ target: voiceProfiles.workspaceId, set: values });
  await audit("voice.updated", { workspaceId: ctx.workspace.id, userId: ctx.user.id });
  revalidatePath("/app/settings/voice");
  if (next?.startsWith("/app/")) redirect(next);
  return { ok: "Voice profile saved. New drafts will use it." };
}

// ─── Demo / sandbox data ───────────────────────────────────────────────

export async function seedDemoAction() {
  const ctx = await requireAuth();
  await seedDemoInbox(ctx.workspace.id);
  revalidatePath("/app/inbox");
  redirect("/app/inbox");
}

export async function clearDemoAction() {
  const ctx = await requireAuth();
  await clearDemoInbox(ctx.workspace.id);
  revalidatePath("/app/inbox");
}

// ─── Meta connection management ────────────────────────────────────────

export async function syncNowAction(form: FormData) {
  const ctx = await requireAuth();
  const id = String(form.get("connectionId"));
  const [conn] = await db
    .select()
    .from(metaConnections)
    .where(and(eq(metaConnections.id, id), eq(metaConnections.workspaceId, ctx.workspace.id)));
  if (conn) await syncConnection(conn).catch((e) => console.error("[sync now]", e));
  revalidatePath("/app/settings/connections");
}

export async function disconnectMetaAction(form: FormData) {
  const ctx = await requireAuth();
  const id = String(form.get("connectionId"));
  const [conn] = await db
    .select()
    .from(metaConnections)
    .where(and(eq(metaConnections.id, id), eq(metaConnections.workspaceId, ctx.workspace.id)));
  if (!conn) return;
  if (conn.status === "active") {
    await unsubscribePageFromApp(conn.pageId, pageToken(conn)).catch(() => undefined);
  }
  // Deleting the connection cascades to its threads/messages/drafts.
  await db.delete(metaConnections).where(eq(metaConnections.id, conn.id));
  await audit("meta.disconnected", { workspaceId: ctx.workspace.id, userId: ctx.user.id, detail: { pageId: conn.pageId } });
  revalidatePath("/app/settings/connections");
}

// ─── Buffer ────────────────────────────────────────────────────────────

export async function connectBufferAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAuth();
  const apiKey = String(form.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "Paste your Buffer API key." };
  let orgs: buffer.BufferOrganization[];
  try {
    orgs = await buffer.getOrganizations(apiKey);
  } catch (err) {
    return { error: `Buffer rejected that key: ${(err as Error).message}` };
  }
  const org = orgs[0];
  const values = {
    apiKeyEnc: encryptSecret(apiKey),
    organizationId: org?.id ?? null,
    organizationName: org?.name ?? null,
  };
  await db
    .insert(bufferConnections)
    .values({ workspaceId: ctx.workspace.id, ...values })
    .onConflictDoUpdate({ target: bufferConnections.workspaceId, set: values });
  await audit("buffer.connected", { workspaceId: ctx.workspace.id, userId: ctx.user.id });
  revalidatePath("/app/schedule");
  revalidatePath("/app/settings/connections");
  return { ok: `Connected to Buffer${org ? ` (${org.name})` : ""}.` };
}

export async function disconnectBufferAction() {
  const ctx = await requireAuth();
  await db.delete(bufferConnections).where(eq(bufferConnections.workspaceId, ctx.workspace.id));
  revalidatePath("/app/settings/connections");
  revalidatePath("/app/schedule");
}

const Post = z.object({
  channelId: z.string().min(1, "Pick a channel"),
  channelLabel: z.string().optional(),
  text: z.string().trim().min(1, "Write something").max(2200),
  imageUrl: z.union([z.literal(""), z.string().url("Image must be a public URL")]).optional(),
  dueAt: z.string().optional(),
  tzOffset: z.coerce.number().optional(),
});

export async function schedulePostAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAuth();
  const parsed = Post.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [conn] = await db.select().from(bufferConnections).where(eq(bufferConnections.workspaceId, ctx.workspace.id));
  if (!conn) return { error: "Connect Buffer first." };

  const { channelId, channelLabel, text, imageUrl, dueAt, tzOffset } = parsed.data;
  // <input type="datetime-local"> has no zone; the browser sends its offset alongside.
  const due = dueAt ? new Date(new Date(`${dueAt}:00Z`).getTime() + (tzOffset ?? 0) * 60_000) : undefined;
  if (due && due.getTime() < Date.now()) return { error: "Pick a time in the future." };

  try {
    const post = await buffer.createPost(decryptSecret(conn.apiKeyEnc), {
      channelId,
      text,
      dueAt: due,
      imageUrl: imageUrl || undefined,
    });
    await db.insert(scheduledPosts).values({
      workspaceId: ctx.workspace.id,
      createdByUserId: ctx.user.id,
      bufferPostId: post.id,
      bufferChannelId: channelId,
      channelLabel,
      text,
      mediaUrl: imageUrl || null,
      dueAt: post.dueAt ? new Date(post.dueAt) : (due ?? null),
    });
  } catch (err) {
    return { error: (err as Error).message };
  }
  revalidatePath("/app/schedule");
  return { ok: due ? "Scheduled!" : "Added to your Buffer queue!" };
}

// ─── Account ───────────────────────────────────────────────────────────

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAuth();
  if (ctx.role !== "owner") return { error: "Only the workspace owner can delete it." };
  if (String(form.get("confirm")) !== "DELETE") return { error: 'Type DELETE to confirm.' };
  const conns = await db.select().from(metaConnections).where(eq(metaConnections.workspaceId, ctx.workspace.id));
  for (const c of conns) {
    if (c.status === "active") await unsubscribePageFromApp(c.pageId, pageToken(c)).catch(() => undefined);
  }
  await deleteWorkspace(ctx.workspace.id);
  await db.delete(users).where(eq(users.id, ctx.user.id));
  await destroySession();
  redirect("/?deleted=1");
}
