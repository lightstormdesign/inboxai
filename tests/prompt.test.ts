import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt, draftOutputSchema } from "@/lib/ai/prompt";

const voice = {
  businessName: "Sunny Studio",
  whatWeDo: "Portrait photography in Austin.",
  audience: "",
  tone: "Warm and playful",
  dos: "",
  donts: "Never quote prices publicly",
  emojiStyle: "sparingly",
  signOff: "",
  samples: ["Omg thank you!! 🥹"],
  faq: [{ q: "Where are you?", a: "East Austin" }, { q: "", a: "ignored" }],
  links: "",
};

describe("prompt builder", () => {
  it("includes voice, FAQ and guardrails, skipping empty sections", () => {
    const p = buildSystemPrompt(voice);
    expect(p).toContain("Sunny Studio");
    expect(p).toContain("Warm and playful");
    expect(p).toContain("Q: Where are you?");
    expect(p).not.toContain("ignored");
    expect(p).not.toContain("## Audience");
    expect(p).toMatch(/never invent/i);
  });

  it("formats conversation history", () => {
    const u = buildUserPrompt({
      kind: "comment",
      channel: "instagram",
      customerHandle: "fan",
      postCaption: "New drop!",
      history: [
        { direction: "inbound", text: "XL?", author: "fan" },
        { direction: "outbound", text: "Yes!" },
      ],
    });
    expect(u).toContain("public comment");
    expect(u).toContain("CUSTOMER (@fan): XL?");
    expect(u).toContain("BUSINESS: Yes!");
    expect(u).toContain("New drop!");
  });

  it("validates model output", () => {
    expect(() =>
      draftOutputSchema.parse({ reply: "hi", intent: "lead", confidence: "high", needs_attention: false, rationale: "ok" }),
    ).not.toThrow();
    expect(() => draftOutputSchema.parse({ reply: "hi", intent: "nope" })).toThrow();
  });
});
