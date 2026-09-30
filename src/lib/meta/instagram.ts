import { graph, graphPaged } from "./graph";

/**
 * Instagram API with Facebook Login — the calls InboxAI makes on behalf of a
 * connected Page. Each function maps to one permission in the review
 * submission (see docs/meta-app-review/02-permissions-justification.md).
 */

// ─── DMs (instagram_manage_messages) ───────────────────────────────────

export type IgConversation = {
  id: string;
  updated_time: string;
  participants: { data: { id: string; username?: string }[] };
  messages?: { data: IgMessage[] };
};

export type IgMessage = {
  id: string;
  created_time: string;
  from: { id: string; username?: string };
  to?: { data: { id: string; username?: string }[] };
  message?: string;
  attachments?: { data: { image_data?: { url: string }; video_data?: { url: string }; file_url?: string }[] };
};

export async function listConversations(pageId: string, pageToken: string, maxPages = 2) {
  return graphPaged<IgConversation>(
    `${pageId}/conversations`,
    {
      token: pageToken,
      params: {
        platform: "instagram",
        fields: "id,updated_time,participants,messages.limit(20){id,created_time,from,to,message,attachments}",
        limit: 25,
      },
    },
    maxPages,
  );
}

export async function getIgUserProfile(igsid: string, pageToken: string) {
  return graph<{ id: string; name?: string; username?: string; profile_pic?: string }>(igsid, {
    token: pageToken,
    params: { fields: "name,username,profile_pic" },
  });
}

/**
 * Send a DM. Inside the 24h window use a standard RESPONSE; between 24h and
 * 7 days Meta requires the HUMAN_AGENT tag (a human is always the sender in
 * InboxAI, which is exactly what that tag is for — it needs its own approval).
 */
export async function sendDirectMessage(
  pageId: string,
  pageToken: string,
  recipientIgsid: string,
  text: string,
  opts: { humanAgentTag?: boolean } = {},
) {
  return graph<{ recipient_id: string; message_id: string }>(`${pageId}/messages`, {
    method: "POST",
    token: pageToken,
    body: {
      recipient: { id: recipientIgsid },
      message: { text },
      ...(opts.humanAgentTag ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : { messaging_type: "RESPONSE" }),
    },
  });
}

/** "Private reply": DM someone who commented, referencing their comment (one per comment, within 7 days). */
export async function sendPrivateReply(pageId: string, pageToken: string, commentId: string, text: string) {
  return graph<{ recipient_id: string; message_id: string }>(`${pageId}/messages`, {
    method: "POST",
    token: pageToken,
    body: { recipient: { comment_id: commentId }, message: { text } },
  });
}

// ─── Comments (instagram_manage_comments) ──────────────────────────────

export type IgComment = {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username?: string };
  hidden?: boolean;
  replies?: { data: IgComment[] };
};

export type IgMedia = {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp: string;
  media_type?: string;
  comments?: { data: IgComment[] };
};

/** Recent posts with their comments + replies. */
export async function listRecentMediaWithComments(igUserId: string, pageToken: string, mediaLimit = 10) {
  const res = await graph<{ data: IgMedia[] }>(`${igUserId}/media`, {
    token: pageToken,
    params: {
      limit: mediaLimit,
      fields:
        "id,caption,permalink,timestamp,media_type," +
        "comments.limit(50){id,text,timestamp,username,from,hidden,replies{id,text,timestamp,username,from}}",
    },
  });
  return res.data;
}

export async function getMedia(mediaId: string, pageToken: string) {
  return graph<IgMedia>(mediaId, { token: pageToken, params: { fields: "id,caption,permalink,timestamp" } });
}

export async function replyToComment(commentId: string, pageToken: string, text: string) {
  return graph<{ id: string }>(`${commentId}/replies`, {
    method: "POST",
    token: pageToken,
    params: { message: text },
  });
}

export async function setCommentHidden(commentId: string, pageToken: string, hide: boolean) {
  return graph<{ success: boolean }>(commentId, { method: "POST", token: pageToken, params: { hide } });
}

export async function deleteComment(commentId: string, pageToken: string) {
  return graph<{ success: boolean }>(commentId, { method: "DELETE", token: pageToken });
}
