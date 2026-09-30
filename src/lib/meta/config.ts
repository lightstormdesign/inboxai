/**
 * Permissions requested via Facebook Login for Business ("Instagram API with
 * Facebook Login"). Every scope here must be justified in
 * docs/meta-app-review/02-permissions-justification.md — do not add scopes
 * the product doesn't visibly use, reviewers reject over-asking.
 */
export const META_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "business_management",
] as const;

/** v2 (Facebook Page inbox) — not requested in the v1 review submission. */
export const META_SCOPES_V2 = ["pages_messaging", "pages_manage_engagement", "pages_read_user_content"] as const;

/** Page webhook fields we subscribe each connected Page to. */
export const PAGE_SUBSCRIBED_FIELDS = ["messages", "messaging_postbacks", "message_echoes", "feed"] as const;

export function graphBase(version: string) {
  return `https://graph.facebook.com/${version}`;
}

/** Meta's standard messaging window. Outside it, replies need the HUMAN_AGENT tag (7 days). */
export const STANDARD_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
