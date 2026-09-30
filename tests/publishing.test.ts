import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

const { validatePost } = await import("@/lib/publishing");
const conn = "00000000-0000-0000-0000-000000000000";

describe("validatePost", () => {
  it("requires at least one target", () => {
    expect(() => validatePost({ text: "hi", targets: [] })).toThrow(/at least one/);
  });
  it("requires media for Instagram", () => {
    expect(() => validatePost({ text: "hi", targets: [{ kind: "ig_feed", connectionId: conn }] })).toThrow(/photo or video/);
    expect(() => validatePost({ text: "", mediaUrl: "https://x/y.jpg", mediaType: "image", targets: [{ kind: "ig_story", connectionId: conn }] })).not.toThrow();
  });
  it("requires video for reels", () => {
    expect(() =>
      validatePost({ text: "", mediaUrl: "https://x/y.jpg", mediaType: "image", targets: [{ kind: "ig_reel", connectionId: conn }] }),
    ).toThrow(/video/);
  });
  it("allows text-only Facebook posts", () => {
    expect(() => validatePost({ text: "Open late tonight!", targets: [{ kind: "fb_post", connectionId: conn }] })).not.toThrow();
  });
});
