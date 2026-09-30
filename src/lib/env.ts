import { z } from "zod";

const schema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_LOGIN_CONFIG_ID: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v25.0"),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
  BUFFER_CLIENT_ID: z.string().optional(),
  BUFFER_CLIENT_SECRET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SIGNUPS_OPEN: z.string().default("true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated env. Lazy so `next build` doesn't need runtime secrets. */
export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  cached = schema.parse(raw);
  return cached;
}

export function appUrl(path = ""): string {
  return `${env().APP_URL.replace(/\/$/, "")}${path}`;
}

export function metaConfigured(): boolean {
  const e = env();
  return Boolean(e.META_APP_ID && e.META_APP_SECRET);
}

export function requireMeta() {
  const e = env();
  if (!e.META_APP_ID || !e.META_APP_SECRET) {
    throw new Error("META_APP_ID / META_APP_SECRET are not configured");
  }
  return { appId: e.META_APP_ID, appSecret: e.META_APP_SECRET, version: e.META_GRAPH_VERSION };
}
