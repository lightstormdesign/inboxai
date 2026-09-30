import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bufferConnections } from "@/db/schema";
import { decryptSecret, encryptSecret, randomToken } from "@/lib/crypto";
import { appUrl, env } from "@/lib/env";

/**
 * Buffer GraphQL API (https://developers.buffer.com). Customers connect with
 * OAuth 2.0 + PKCE ("Connect with Buffer"); a pasted personal API key is
 * supported as a fallback. Buffer is optional — Instagram and Facebook
 * publishing goes direct through Meta (see lib/publishing.ts). Buffer is for
 * people who already use it, or for other networks (TikTok, LinkedIn, …).
 *
 * Endpoint/param names follow Buffer's docs as of Sept 2026; the API is new,
 * so re-check developers.buffer.com if a call starts failing.
 */
const ENDPOINT = "https://api.buffer.com";
const AUTH_URL = "https://auth.buffer.com/auth";
const TOKEN_URL = "https://auth.buffer.com/token";
export const BUFFER_SCOPES = ["posts:write", "posts:read", "account:read", "offline_access"];
export const BUFFER_REDIRECT_PATH = "/api/buffer/callback";

export function bufferOAuthConfigured() {
  return Boolean(env().BUFFER_CLIENT_ID);
}

// ─── OAuth (Authorization Code + PKCE) ─────────────────────────────────

export function createPkce() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildBufferAuthUrl(state: string, codeChallenge: string) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", env().BUFFER_CLIENT_ID!);
  url.searchParams.set("redirect_uri", appUrl(BUFFER_REDIRECT_PATH));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", BUFFER_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET } = env();
  const body = new URLSearchParams({ client_id: BUFFER_CLIENT_ID!, ...params });
  if (BUFFER_CLIENT_SECRET) body.set("client_secret", BUFFER_CLIENT_SECRET);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new BufferError(json.error_description ?? json.error ?? `Buffer token request failed (${res.status})`);
  }
  return json;
}

export function exchangeBufferCode(code: string, codeVerifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: appUrl(BUFFER_REDIRECT_PATH),
    code_verifier: codeVerifier,
  });
}

export function tokenColumns(t: TokenResponse) {
  return {
    authType: "oauth" as const,
    accessTokenEnc: encryptSecret(t.access_token),
    refreshTokenEnc: t.refresh_token ? encryptSecret(t.refresh_token) : null,
    expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
  };
}

/** A usable bearer token for this workspace's Buffer connection, refreshing if needed. */
export async function getBufferToken(workspaceId: string): Promise<string | null> {
  const [conn] = await db.select().from(bufferConnections).where(eq(bufferConnections.workspaceId, workspaceId));
  if (!conn) return null;
  const expiringSoon = conn.expiresAt && conn.expiresAt.getTime() - Date.now() < 60_000;
  if (conn.authType === "oauth" && expiringSoon && conn.refreshTokenEnc) {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(conn.refreshTokenEnc) });
    const cols = tokenColumns(t);
    // Some providers don't rotate refresh tokens; keep the old one if none returned.
    if (!cols.refreshTokenEnc) cols.refreshTokenEnc = conn.refreshTokenEnc;
    await db.update(bufferConnections).set(cols).where(eq(bufferConnections.workspaceId, workspaceId));
    return t.access_token;
  }
  return decryptSecret(conn.accessTokenEnc);
}


export class BufferError extends Error {}

async function gql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new BufferError(json.errors?.map((e) => e.message).join("; ") || `Buffer API ${res.status}`);
  }
  return json.data as T;
}

export type BufferOrganization = { id: string; name: string };
export type BufferChannel = { id: string; name: string; service: string; avatar?: string | null };

export async function getOrganizations(apiKey: string): Promise<BufferOrganization[]> {
  const data = await gql<{ account: { organizations: BufferOrganization[] } }>(
    apiKey,
    `query { account { organizations { id name } } }`,
  );
  return data.account.organizations;
}

export async function getChannels(apiKey: string, organizationId: string): Promise<BufferChannel[]> {
  const data = await gql<{ channels: BufferChannel[] }>(
    apiKey,
    `query Channels($organizationId: OrganizationId!) {
       channels(input: { organizationId: $organizationId }) { id name service avatar }
     }`,
    { organizationId },
  );
  return data.channels;
}

export async function createPost(
  apiKey: string,
  input: { channelId: string; text: string; dueAt?: Date; imageUrl?: string },
): Promise<{ id: string; dueAt: string | null }> {
  const data = await gql<{
    createPost: { post?: { id: string; dueAt: string | null }; message?: string };
  }>(
    apiKey,
    `mutation CreatePost($input: CreatePostInput!) {
       createPost(input: $input) {
         ... on PostActionSuccess { post { id dueAt } }
         ... on MutationError { message }
       }
     }`,
    {
      input: {
        channelId: input.channelId,
        text: input.text,
        schedulingType: "automatic",
        mode: input.dueAt ? "customScheduled" : "addToQueue",
        ...(input.dueAt ? { dueAt: input.dueAt.toISOString() } : {}),
        ...(input.imageUrl ? { assets: { images: [{ url: input.imageUrl }] } } : {}),
      },
    },
  );
  if (!data.createPost.post) throw new BufferError(data.createPost.message ?? "Buffer rejected the post");
  return data.createPost.post;
}
