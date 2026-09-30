import { hmacSha256, safeEqual } from "@/lib/crypto";

export type SignedRequest = {
  algorithm: string;
  user_id: string;
  issued_at?: number;
  expires?: number;
};

/**
 * Parse the `signed_request` Meta posts to the Deauthorize and Data Deletion
 * callbacks: `<b64url sig>.<b64url json>`, HMAC-SHA256 with the app secret.
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): SignedRequest | null {
  const [sig, payload] = signedRequest.split(".", 2);
  if (!sig || !payload) return null;
  if (!safeEqual(sig.replace(/=+$/, ""), hmacSha256(appSecret, payload, "base64url"))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedRequest;
    if (data.algorithm?.toUpperCase() !== "HMAC-SHA256" || !data.user_id) return null;
    return data;
  } catch {
    return null;
  }
}
