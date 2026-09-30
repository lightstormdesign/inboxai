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
  users,
  voiceProfiles,
  workspaces,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, destroySession, requireAuth } from "@/lib/auth";
import * as buffer from "@/lib/buffer";
import { deleteWorkspace } from "@/lib/compliance";
import { encryptSecret, hashPassword, verifyPassword } from "@/lib/crypto";
import { clearDemoInbox, seedDemoInbox } from "@/lib/demo";
import { env } from "@/lib/env";
import { pageToken } from "@/lib/inbox";
import { unsubscribePageFromApp } from "@/lib/meta/oauth";
import { cancelPost, createPost, PublishError, type TargetInput } from "@/lib/publishing";
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
    authType: "api_key" as const,
    accessTokenEnc: encryptSecret(apiKey),
    refreshTokenEnc: null,
    expiresAt: null,
    organizationId: org?.id ?? null,
    organizationName: org?.name ?? null,
  };
  await db
    .insert(bufferConnections)
    .values({ workspaceId: ctx.workspace.id, ...values })
    .onConflictDoUpdate({ target: bufferConnections.workspaceId, set: values });
  await audit("buffer.connected", { workspaceId: ctx.workspace.id, userId: ctx.user.id, detail: { via: "api_key" } });
  revalidatePath("/app/publish");
  revalidatePath("/app/settings/connections");
  return { ok: `Connected to Buffer${org ? ` (${org.name})` : ""}.` };
}

export async function disconnectBufferAction() {
  const ctx = await requireAuth();
  await db.delete(bufferConnections).where(eq(bufferConnections.workspaceId, ctx.workspace.id));
  revalidatePath("/app/settings/connections");
  revalidatePath("/app/publish");
}

const PostForm = z.object({
  text: z.string().trim().max(2200),
  mediaUrl: z.union([z.literal(""), z.string().url()]).optional(),
  mediaType: z.enum(["image", "video", ""]).optional(),
  when: z.enum(["now", "later"]),
  dueAt: z.string().optional(),
  tzOffset: z.coerce.number().optional(),
  /** JSON array of TargetInput, built by the composer. */
  targets: z.string(),
});

const Target = z.union([
  z.object({ kind: z.enum(["ig_feed", "ig_story", "ig_reel", "fb_post"]), connectionId: z.string().uuid() }),
  z.object({ kind: z.literal("buffer"), bufferChannelId: z.string().min(1), label: z.string().optional() }),
]);

export async function createPostAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireAuth();
  const parsed = PostForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { text, mediaUrl, mediaType, when, dueAt, tzOffset } = parsed.data;

  let targets: TargetInput[];
  try {
    targets = z.array(Target).parse(JSON.parse(parsed.data.targets));
  } catch {
    return { error: "Pick at least one place to post." };
  }

  let scheduledAt: Date | undefined;
  if (when === "later") {
    if (!dueAt) return { error: "Pick a date and time." };
    // <input type="datetime-local"> has no zone; the browser sends its offset alongside.
    scheduledAt = new Date(new Date(`${dueAt}:00Z`).getTime() + (tzOffset ?? 0) * 60_000);
    if (scheduledAt.getTime() < Date.now() + 60_000) return { error: "Pick a time at least a minute from now." };
  }

  let result: Awaited<ReturnType<typeof createPost>>;
  try {
    result = await createPost({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      text,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      scheduledAt,
      targets,
    });
  } catch (err) {
    if (err instanceof PublishError) return { error: err.message };
    console.error("[createPost]", err);
    return { error: "Couldn't create the post. Please try again." };
  }
  revalidatePath("/app/publish");
  switch (result.status) {
    case "failed":
      return { error: "Publishing failed — see the details below." };
    case "partial":
      return { error: "Some destinations failed — see the details below." };
    case "publishing":
      return { ok: "Publishing… videos can take a minute to process. Status updates below." };
    case "scheduled":
      return { ok: scheduledAt ? "Scheduled!" : "Queued." };
    default:
      return { ok: "Published!" };
  }
}

export async function cancelPostAction(form: FormData) {
  const ctx = await requireAuth();
  await cancelPost(ctx.workspace.id, String(form.get("postId")));
  revalidatePath("/app/publish");
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
