import { describe, expect, it } from "vitest";
import { messagingWindow } from "@/lib/meta/window";

const H = 3_600_000;
const now = Date.UTC(2026, 9, 1);

describe("messagingWindow", () => {
  it("classifies by age of the last inbound message", () => {
    expect(messagingWindow(new Date(now - 1 * H), now)).toBe("standard");
    expect(messagingWindow(new Date(now - 30 * H), now)).toBe("human_agent");
    expect(messagingWindow(new Date(now - 8 * 24 * H), now)).toBe("closed");
    expect(messagingWindow(null, now)).toBe("closed");
  });
});
