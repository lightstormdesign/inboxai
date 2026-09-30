import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "@/lib/meta/signed-request";
import { parseInstagramWebhook, verifyWebhookSignature } from "@/lib/meta/webhooks";

const SECRET = "app-secret";

describe("webhook signature", () => {
  it("accepts a valid X-Hub-Signature-256 and rejects others", () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const sig = "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "sha1=abc", SECRET)).toBe(false);
  });
});

describe("signed_request", () => {
  const make = (payload: object, secret = SECRET) => {
    const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const s = createHmac("sha256", secret).update(p).digest("base64url");
    return `${s}.${p}`;
  };

  it("parses a valid request", () => {
    expect(parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "123" }), SECRET)?.user_id).toBe("123");
  });
  it("rejects a bad signature", () => {
    expect(parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "123" }, "nope"), SECRET)).toBeNull();
  });
  it("rejects a wrong algorithm", () => {
    expect(parseSignedRequest(make({ algorithm: "none", user_id: "123" }), SECRET)).toBeNull();
  });
});

describe("parseInstagramWebhook", () => {
  it("normalizes DMs, echoes and comments", () => {
    const events = parseInstagramWebhook({
      object: "instagram",
      entry: [
        {
          id: "IG_BIZ",
          time: 1_700_000_000,
          messaging: [
            { sender: { id: "CUST" }, recipient: { id: "IG_BIZ" }, timestamp: 1_700_000_000_000, message: { mid: "m1", text: "hi" } },
            { sender: { id: "IG_BIZ" }, recipient: { id: "CUST" }, timestamp: 1_700_000_001_000, message: { mid: "m2", text: "hello", is_echo: true } },
            { sender: { id: "CUST" }, recipient: { id: "IG_BIZ" }, message: { mid: "m3", is_deleted: true } },
          ],
          changes: [
            { field: "comments", value: { id: "c1", text: "love it", from: { id: "U1", username: "fan" }, media: { id: "MEDIA" } } },
            { field: "mentions", value: { id: "x" } },
          ],
        },
      ],
    });
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: "dm", customerId: "CUST", isEcho: false, text: "hi" });
    expect(events[1]).toMatchObject({ type: "dm", customerId: "CUST", isEcho: true });
    expect(events[2]).toMatchObject({ type: "comment", commentId: "c1", fromUsername: "fan", mediaId: "MEDIA" });
  });

  it("ignores non-instagram objects", () => {
    expect(parseInstagramWebhook({ object: "page", entry: [] })).toEqual([]);
  });
});
