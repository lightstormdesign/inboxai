import { z } from "zod";
import type { FaqEntry } from "@/db/schema";

/** Bump when the prompt changes materially — stored on every draft for later evaluation. */
export const PROMPT_VERSION = "2026-10-01.1";

export type VoiceInput = {
  businessName: string;
  whatWeDo: string;
  audience: string;
  tone: string;
  dos: string;
  donts: string;
  emojiStyle: string;
  signOff: string;
  samples: string[];
  faq: FaqEntry[];
  links: string;
};

export type ConversationTurn = { direction: "inbound" | "outbound"; text: string; author?: string | null };

export type DraftContext = {
  kind: "dm" | "comment";
  channel: "instagram" | "facebook";
  customerHandle?: string | null;
  postCaption?: string | null;
  history: ConversationTurn[];
};

export const INTENTS = ["question", "lead", "praise", "complaint", "support", "spam", "other"] as const;

export const draftOutputSchema = z.object({
  reply: z.string(),
  intent: z.enum(INTENTS),
  confidence: z.enum(["high", "medium", "low"]),
  needs_attention: z.boolean(),
  rationale: z.string(),
});

export type DraftOutput = z.infer<typeof draftOutputSchema>;

/** JSON Schema handed to OpenAI Structured Outputs (mirrors draftOutputSchema). */
export const draftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "intent", "confidence", "needs_attention", "rationale"],
  properties: {
    reply: { type: "string", description: "The suggested reply text, ready to send. Empty string for spam." },
    intent: { type: "string", enum: [...INTENTS] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    needs_attention: {
      type: "boolean",
      description: "True if a human should look closely: complaints, refunds, legal/medical/safety, or facts not in the profile.",
    },
    rationale: { type: "string", description: "One short sentence for the human reviewer explaining the draft." },
  },
} as const;

const MAX_HISTORY = 12;

function section(title: string, body: string | undefined | null) {
  const b = (body ?? "").trim();
  return b ? `## ${title}\n${b}\n` : "";
}

export function buildSystemPrompt(voice: VoiceInput): string {
  const samples = voice.samples.filter((s) => s.trim()).slice(0, 8);
  const faq = voice.faq.filter((f) => f.q.trim() && f.a.trim()).slice(0, 30);
  return [
    `You draft replies to Instagram/Facebook direct messages and comments on behalf of ${voice.businessName || "a small business"}.`,
    `A human at the business will review, edit, and approve every draft before it is sent. Write the reply exactly as the business would send it.`,
    "",
    section("About the business", voice.whatWeDo),
    section("Audience", voice.audience),
    section("Brand voice & tone", voice.tone),
    section("Always", voice.dos),
    section("Never", voice.donts),
    section("Emoji usage", voice.emojiStyle),
    section("Sign-off (DMs only, optional)", voice.signOff),
    section("Links you may share", voice.links),
    faq.length ? `## Known facts / FAQ (the ONLY facts you may state)\n${faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}\n` : "",
    samples.length
      ? `## Examples of how this business actually writes (match this style, don't copy verbatim)\n${samples.map((s, i) => `Example ${i + 1}:\n"""${s}"""`).join("\n\n")}\n`
      : "",
    `## Rules`,
    `- Match the voice above. Sound like a real person at the business, not a bot. Never say you are an AI.`,
    `- Reply in the same language the customer wrote in.`,
    `- Keep it short: comments 1–2 sentences; DMs usually under 80 words.`,
    `- Only state facts found in the FAQ/profile. If you don't know (prices, availability, policies), say you'll check or invite them to DM/book — never invent details, discounts, or promises.`,
    `- Public comments: never ask for or reveal personal info; move anything sensitive (orders, complaints, pricing specifics) to DMs.`,
    `- Complaints, refunds, harassment, legal, medical, or safety topics: write a calm, empathetic holding reply and set needs_attention=true.`,
    `- Obvious spam/bots/scams: intent="spam", reply="".`,
    `- No hashtags in replies. No markdown. Plain text only.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildUserPrompt(ctx: DraftContext): string {
  const history = ctx.history.filter((t) => t.text.trim()).slice(-MAX_HISTORY);
  const lines = history.map((t) =>
    t.direction === "inbound" ? `CUSTOMER${t.author ? ` (@${t.author})` : ""}: ${t.text}` : `BUSINESS: ${t.text}`,
  );
  return [
    `Channel: ${ctx.channel} ${ctx.kind === "dm" ? "direct message" : "public comment"}`,
    ctx.customerHandle ? `Customer handle: @${ctx.customerHandle}` : "",
    ctx.kind === "comment" && ctx.postCaption ? `The comment is on this post:\n"""${ctx.postCaption.slice(0, 600)}"""` : "",
    `Conversation so far (oldest first):`,
    lines.join("\n"),
    "",
    `Draft the business's next reply to the latest CUSTOMER message.`,
  ]
    .filter(Boolean)
    .join("\n");
}
