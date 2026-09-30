import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ─── Accounts & tenancy ────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token — the raw token is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** A workspace is the tenant boundary. Every row below hangs off one. */
export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const roleEnum = pgEnum("member_role", ["owner", "admin", "member"]);

export const memberships = pgTable(
  "memberships",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

// ─── Connections (encrypted third-party credentials) ───────────────────

export const connectionStatus = pgEnum("connection_status", ["active", "revoked", "error"]);

/** One row per Facebook Page (+ linked Instagram professional account) a workspace connects. */
export const metaConnections = pgTable(
  "meta_connections",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    connectedByUserId: uuid("connected_by_user_id").references(() => users.id, { onDelete: "set null" }),
    fbUserId: text("fb_user_id").notNull(),
    pageId: text("page_id").notNull(),
    pageName: text("page_name").notNull(),
    igUserId: text("ig_user_id"),
    igUsername: text("ig_username"),
    igProfilePictureUrl: text("ig_profile_picture_url"),
    /** AES-256-GCM encrypted Page access token (long-lived / non-expiring). */
    pageAccessTokenEnc: text("page_access_token_enc").notNull(),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    status: connectionStatus("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("meta_conn_ws_page_uq").on(t.workspaceId, t.pageId),
    index("meta_conn_ig_idx").on(t.igUserId),
    index("meta_conn_fb_user_idx").on(t.fbUserId),
  ],
);

/**
 * Buffer's GraphQL API currently only supports personal API keys (no
 * third-party OAuth yet), so each customer pastes their own key.
 */
export const bufferConnections = pgTable("buffer_connections", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  apiKeyEnc: text("api_key_enc").notNull(),
  organizationId: text("organization_id"),
  organizationName: text("organization_name"),
  createdAt: createdAt(),
});

// ─── Voice profile (the product differentiator) ────────────────────────

export type FaqEntry = { q: string; a: string };

export const voiceProfiles = pgTable("voice_profiles", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull().default(""),
  whatWeDo: text("what_we_do").notNull().default(""),
  audience: text("audience").notNull().default(""),
  tone: text("tone").notNull().default(""),
  dos: text("dos").notNull().default(""),
  donts: text("donts").notNull().default(""),
  emojiStyle: text("emoji_style").notNull().default("sparingly"),
  signOff: text("sign_off").notNull().default(""),
  /** Real past replies/posts written by the business — few-shot style anchors. */
  samples: jsonb("samples").$type<string[]>().notNull().default([]),
  faq: jsonb("faq").$type<FaqEntry[]>().notNull().default([]),
  /** Links the AI may share (booking page, shop, etc). */
  links: text("links").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Unified inbox ─────────────────────────────────────────────────────

export const channelEnum = pgEnum("channel", ["instagram", "facebook"]);
export const threadKindEnum = pgEnum("thread_kind", ["dm", "comment"]);
export const threadStatusEnum = pgEnum("thread_status", ["open", "done", "archived"]);
export const intentEnum = pgEnum("intent", [
  "question",
  "lead",
  "praise",
  "complaint",
  "support",
  "spam",
  "other",
]);

/**
 * A thread is one row in the unified inbox: either a DM conversation with a
 * person, or a top-level comment on a post (its replies live in `messages`).
 */
export const threads = pgTable(
  "threads",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => metaConnections.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull().default("instagram"),
    kind: threadKindEnum("kind").notNull(),
    /** DM: the other participant's IGSID. Comment: the top-level comment id. */
    externalId: text("external_id").notNull(),
    participantId: text("participant_id"),
    participantUsername: text("participant_username"),
    participantName: text("participant_name"),
    mediaId: text("media_id"),
    mediaPermalink: text("media_permalink"),
    mediaCaption: text("media_caption"),
    status: threadStatusEnum("status").notNull().default("open"),
    unread: boolean("unread").notNull().default(true),
    intent: intentEnum("intent"),
    needsAttention: boolean("needs_attention").notNull().default(false),
    /** Timestamp of the latest message from the customer — drives Meta's 24h messaging window. */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("threads_ws_kind_ext_uq").on(t.workspaceId, t.kind, t.externalId),
    index("threads_inbox_idx").on(t.workspaceId, t.status, t.lastMessageAt),
  ],
);

export const directionEnum = pgEnum("direction", ["inbound", "outbound"]);

export type Attachment = { type: string; url?: string };

export const messages = pgTable(
  "messages",
  {
    id: id(),
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    /** Meta message id (mid) or comment id. Null for locally-sent demo messages. */
    externalId: text("external_id"),
    direction: directionEnum("direction").notNull(),
    text: text("text").notNull().default(""),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    authorName: text("author_name"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    /** For outbound messages sent from InboxAI: which human approved it. */
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("messages_thread_ext_uq").on(t.threadId, t.externalId),
    index("messages_thread_idx").on(t.threadId, t.sentAt),
  ],
);

export const draftStatusEnum = pgEnum("draft_status", ["pending", "sent", "discarded", "failed", "superseded"]);

/** AI-suggested replies. Never sent without an explicit human approval (see lib/inbox.ts#sendReply). */
export const drafts = pgTable(
  "drafts",
  {
    id: id(),
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    /** The inbound message this draft answers. */
    replyToMessageId: uuid("reply_to_message_id").references(() => messages.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    status: draftStatusEnum("status").notNull().default("pending"),
    confidence: text("confidence"),
    rationale: text("rationale"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    error: text("error"),
    /** What the human actually sent (may differ from `text` if edited). */
    finalText: text("final_text"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("drafts_thread_idx").on(t.threadId, t.status)],
);

// ─── Publishing (Buffer) ───────────────────────────────────────────────

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    bufferPostId: text("buffer_post_id"),
    bufferChannelId: text("buffer_channel_id").notNull(),
    channelLabel: text("channel_label"),
    text: text("text").notNull(),
    mediaUrl: text("media_url"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("scheduled"),
    createdAt: createdAt(),
  },
  (t) => [index("scheduled_posts_ws_idx").on(t.workspaceId, t.dueAt)],
);

// ─── Compliance & ops ──────────────────────────────────────────────────

/** Raw webhook deliveries, kept briefly for debugging + idempotency. Purged after 14 days. */
export const webhookEvents = pgTable("webhook_events", {
  id: id(),
  object: text("object").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
});

/** Meta Data Deletion Callback requests — status is publicly checkable by confirmation code. */
export const dataDeletionRequests = pgTable("data_deletion_requests", {
  id: id(),
  confirmationCode: text("confirmation_code").notNull().unique(),
  fbUserId: text("fb_user_id").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull().default("pending"),
  detail: text("detail"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_ws_idx").on(t.workspaceId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type MetaConnection = typeof metaConnections.$inferSelect;
export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
