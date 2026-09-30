import { hmacSha256 } from "@/lib/crypto";
import { requireMeta } from "@/lib/env";
import { graphBase } from "./config";

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly type?: string,
    readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = "GraphError";
  }

  /** Token expired / revoked / password changed / app removed. */
  get isAuthError() {
    return this.code === 190 || this.code === 102 || (this.type === "OAuthException" && this.status === 401);
  }

  /** Outside the allowed messaging window. */
  get isWindowError() {
    return this.code === 10 && this.subcode === 2018278;
  }

  get isRateLimit() {
    return [4, 17, 32, 613].includes(this.code ?? -1);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

/**
 * Minimal Graph API client. Adds `appsecret_proof` on every call so the app
 * can enable "Require App Secret" in the dashboard (recommended for review).
 */
export async function graph<T = unknown>(
  path: string,
  opts: { token?: string; method?: "GET" | "POST" | "DELETE"; params?: Params; body?: unknown } = {},
): Promise<T> {
  const { appSecret, version } = requireMeta();
  const url = new URL(`${graphBase(version)}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  if (opts.token) {
    url.searchParams.set("access_token", opts.token);
    url.searchParams.set("appsecret_proof", hmacSha256(appSecret, opts.token));
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: Record<string, unknown> } & T;
  if (!res.ok || json.error) {
    const e = (json.error ?? {}) as Record<string, unknown>;
    throw new GraphError(
      String(e.message ?? `Graph API ${res.status}`),
      res.status,
      e.code as number | undefined,
      e.error_subcode as number | undefined,
      e.type as string | undefined,
      e.fbtrace_id as string | undefined,
    );
  }
  return json;
}

/** Follow `paging.next` up to `maxPages`. */
export async function graphPaged<T>(
  path: string,
  opts: { token: string; params?: Params },
  maxPages = 5,
): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await graph<{ data: T[]; paging?: { cursors?: { after?: string }; next?: string } }>(path, {
      token: opts.token,
      params: { ...opts.params, after },
    });
    out.push(...page.data);
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}
