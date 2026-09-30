import { graph } from "./graph";

/**
 * Direct publishing to Instagram (instagram_content_publish) and Facebook
 * Pages (pages_manage_posts). Media must be at a publicly reachable URL —
 * we upload to Vercel Blob first (see /api/upload).
 *
 * Instagram publishing is two-step: create a media container, wait until it's
 * FINISHED (instant for images, can take a minute+ for video), then publish.
 */

export type IgContainerKind = "feed" | "story" | "reel";

export async function createIgContainer(
  igUserId: string,
  token: string,
  opts: { kind: IgContainerKind; mediaUrl: string; mediaType: "image" | "video"; caption?: string },
): Promise<string> {
  const params: Record<string, string> = {};
  if (opts.kind === "reel") {
    params.media_type = "REELS";
    params.video_url = opts.mediaUrl;
  } else if (opts.kind === "story") {
    params.media_type = "STORIES";
    params[opts.mediaType === "video" ? "video_url" : "image_url"] = opts.mediaUrl;
  } else if (opts.mediaType === "video") {
    // Feed videos are published as Reels by Instagram.
    params.media_type = "REELS";
    params.video_url = opts.mediaUrl;
  } else {
    params.image_url = opts.mediaUrl;
  }
  // Stories don't take captions.
  if (opts.caption && opts.kind !== "story") params.caption = opts.caption;
  const res = await graph<{ id: string }>(`${igUserId}/media`, { method: "POST", token, params });
  return res.id;
}

export type ContainerStatus = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function getIgContainerStatus(containerId: string, token: string) {
  const res = await graph<{ status_code: ContainerStatus; status?: string }>(containerId, {
    token,
    params: { fields: "status_code,status" },
  });
  return res;
}

export async function publishIgContainer(igUserId: string, token: string, containerId: string) {
  const res = await graph<{ id: string }>(`${igUserId}/media_publish`, {
    method: "POST",
    token,
    params: { creation_id: containerId },
  });
  const media = await graph<{ id: string; permalink?: string }>(res.id, { token, params: { fields: "id,permalink" } }).catch(
    () => ({ id: res.id, permalink: undefined }),
  );
  return media;
}

/** Wait (bounded) for a container to finish processing. Returns the last status seen. */
export async function waitForIgContainer(containerId: string, token: string, maxMs = 40_000): Promise<ContainerStatus> {
  const start = Date.now();
  let delay = 1_000;
  for (;;) {
    const { status_code } = await getIgContainerStatus(containerId, token);
    if (status_code !== "IN_PROGRESS" || Date.now() - start > maxMs) return status_code;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.6, 8_000);
  }
}

export async function publishFacebookPost(
  pageId: string,
  token: string,
  opts: { text: string; mediaUrl?: string | null; mediaType?: "image" | "video" | null },
): Promise<{ id: string; permalink?: string }> {
  let id: string;
  if (opts.mediaUrl && opts.mediaType === "image") {
    const res = await graph<{ id: string; post_id?: string }>(`${pageId}/photos`, {
      method: "POST",
      token,
      params: { url: opts.mediaUrl, caption: opts.text },
    });
    id = res.post_id ?? res.id;
  } else if (opts.mediaUrl && opts.mediaType === "video") {
    const res = await graph<{ id: string }>(`${pageId}/videos`, {
      method: "POST",
      token,
      params: { file_url: opts.mediaUrl, description: opts.text },
    });
    id = res.id;
  } else {
    const res = await graph<{ id: string }>(`${pageId}/feed`, { method: "POST", token, params: { message: opts.text } });
    id = res.id;
  }
  const post = await graph<{ permalink_url?: string }>(id, { token, params: { fields: "permalink_url" } }).catch(() => ({
    permalink_url: undefined,
  }));
  return { id, permalink: post.permalink_url };
}
