import { graph, graphPaged } from "./graph";

/**
 * Facebook Page inbox calls (Messenger DMs + Page post comments). Each maps to
 * a permission in docs/meta-app-review/02-permissions-justification.md.
 * Sending a DM uses the same `/{page-id}/messages` endpoint as Instagram — see
 * `sendDirectMessage` / `sendPrivateReply` in ./instagram.ts.
 */

// ─── Messenger (pages_messaging) ───────────────────────────────────────

export type FbConversation = {
  id: string;
  updated_time: string;
  messages?: { data: FbMessage[] };
};

export type FbMessage = {
  id: string;
  created_time: string;
  from: { id: string; name?: string };
  to?: { data: { id: string; name?: string }[] };
  message?: string;
  attachments?: { data: { image_data?: { url: string }; video_data?: { url: string }; file_url?: string }[] };
};

export async function listMessengerConversations(pageId: string, pageToken: string, maxPages = 1) {
  return graphPaged<FbConversation>(
    `${pageId}/conversations`,
    {
      token: pageToken,
      params: {
        fields: "id,updated_time,messages.limit(20){id,created_time,from,to,message,attachments}",
        limit: 25,
      },
    },
    maxPages,
  );
}

export async function getPsidProfile(psid: string, pageToken: string) {
  return graph<{ id: string; name?: string; first_name?: string; last_name?: string }>(psid, {
    token: pageToken,
    params: { fields: "name,first_name,last_name" },
  });
}

// ─── Page comments (pages_read_user_content, pages_manage_engagement) ──

export type FbComment = {
  id: string;
  message: string;
  created_time: string;
  from?: { id: string; name?: string };
  is_hidden?: boolean;
  comments?: { data: FbComment[] };
};

export type FbPost = {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time: string;
  comments?: { data: FbComment[] };
};

export async function listRecentPostsWithComments(pageId: string, pageToken: string, limit = 10) {
  const res = await graph<{ data: FbPost[] }>(`${pageId}/published_posts`, {
    token: pageToken,
    params: {
      limit,
      fields:
        "id,message,permalink_url,created_time," +
        "comments.limit(50){id,message,created_time,from,is_hidden,comments{id,message,created_time,from}}",
    },
  });
  return res.data;
}

export async function getPost(postId: string, pageToken: string) {
  return graph<FbPost>(postId, { token: pageToken, params: { fields: "id,message,permalink_url,created_time" } });
}

export async function replyToFbComment(commentId: string, pageToken: string, text: string) {
  return graph<{ id: string }>(`${commentId}/comments`, { method: "POST", token: pageToken, params: { message: text } });
}

export async function setFbCommentHidden(commentId: string, pageToken: string, hide: boolean) {
  return graph<{ success: boolean }>(commentId, { method: "POST", token: pageToken, params: { is_hidden: hide } });
}

export async function deleteFbComment(commentId: string, pageToken: string) {
  return graph<{ success: boolean }>(commentId, { method: "DELETE", token: pageToken });
}
