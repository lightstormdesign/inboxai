import { env, appUrl, requireMeta } from "@/lib/env";
import { graph } from "./graph";
import { META_SCOPES, PAGE_SUBSCRIBED_FIELDS } from "./config";

export const META_REDIRECT_PATH = "/api/meta/callback";

/**
 * Facebook Login for Business. When META_LOGIN_CONFIG_ID is set we use the
 * configuration (permissions are defined in the dashboard); otherwise we fall
 * back to an explicit `scope` list, which is handy in development.
 */
export function buildLoginUrl(state: string): string {
  const { appId, version } = requireMeta();
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", appUrl(META_REDIRECT_PATH));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  const configId = env().META_LOGIN_CONFIG_ID;
  if (configId) {
    url.searchParams.set("config_id", configId);
    url.searchParams.set("override_default_response_type", "true");
  } else {
    url.searchParams.set("scope", META_SCOPES.join(","));
  }
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const { appId, appSecret } = requireMeta();
  const res = await graph<{ access_token: string }>("oauth/access_token", {
    params: {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: appUrl(META_REDIRECT_PATH),
      code,
    },
  });
  return res.access_token;
}

/** Short-lived (~1h) user token → long-lived (~60d). Page tokens derived from it don't expire. */
export async function exchangeForLongLivedToken(shortLived: string): Promise<{ token: string; expiresIn?: number }> {
  const { appId, appSecret } = requireMeta();
  const res = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLived,
    },
  });
  return { token: res.access_token, expiresIn: res.expires_in };
}

export async function getMe(userToken: string) {
  return graph<{ id: string; name?: string }>("me", { token: userToken, params: { fields: "id,name" } });
}

export async function getGrantedScopes(userToken: string): Promise<string[]> {
  const res = await graph<{ data: { permission: string; status: string }[] }>("me/permissions", { token: userToken });
  return res.data.filter((p) => p.status === "granted").map((p) => p.permission);
}

export type PageWithInstagram = {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
};

export async function listPages(userToken: string): Promise<PageWithInstagram[]> {
  const res = await graph<{ data: PageWithInstagram[] }>("me/accounts", {
    token: userToken,
    params: {
      fields: "id,name,access_token,tasks,instagram_business_account{id,username,profile_picture_url}",
      limit: 100,
    },
  });
  return res.data;
}

/** Subscribe the Page to our app's webhooks so IG DMs + comments are pushed to /api/meta/webhook. */
export async function subscribePageToApp(pageId: string, pageToken: string) {
  return graph<{ success: boolean }>(`${pageId}/subscribed_apps`, {
    method: "POST",
    token: pageToken,
    params: { subscribed_fields: PAGE_SUBSCRIBED_FIELDS.join(",") },
  });
}

export async function unsubscribePageFromApp(pageId: string, pageToken: string) {
  return graph<{ success: boolean }>(`${pageId}/subscribed_apps`, { method: "DELETE", token: pageToken });
}
