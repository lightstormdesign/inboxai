import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import {
  buildSystemPrompt,
  buildUserPrompt,
  draftJsonSchema,
  draftOutputSchema,
  type DraftContext,
  type DraftOutput,
  type VoiceInput,
} from "./prompt";

let client: OpenAI | null = null;
function openai() {
  client ??= new OpenAI({ apiKey: env().OPENAI_API_KEY });
  return client;
}

export type DraftResult = DraftOutput & { model: string };

/**
 * Ask OpenAI for a suggested reply. Output is ALWAYS stored as a pending
 * draft — callers must never send it without an explicit human approval.
 */
export async function generateDraft(voice: VoiceInput, ctx: DraftContext): Promise<DraftResult> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = env();
  if (!OPENAI_API_KEY) return offlineDraft(ctx);

  const res = await openai().responses.create({
    model: OPENAI_MODEL,
    instructions: buildSystemPrompt(voice),
    input: buildUserPrompt(ctx),
    text: {
      format: { type: "json_schema", name: "reply_draft", strict: true, schema: draftJsonSchema as unknown as Record<string, unknown> },
    },
    // Customer messages are sent to OpenAI for drafting only; don't retain them as stored responses.
    store: false,
  });

  const parsed = draftOutputSchema.parse(JSON.parse(res.output_text));
  return { ...parsed, model: res.model ?? OPENAI_MODEL };
}

/** Deterministic stand-in so the whole app works locally without an OpenAI key. */
function offlineDraft(ctx: DraftContext): DraftResult {
  const last = [...ctx.history].reverse().find((t) => t.direction === "inbound")?.text ?? "";
  const who = ctx.customerHandle ? ` @${ctx.customerHandle}` : "";
  const reply =
    ctx.kind === "comment"
      ? `Thank you${who}! 🙌 Sending you a DM with the details.`
      : `Hey${who}! Thanks so much for reaching out — ${last.includes("?") ? "great question, let me check and get right back to you." : "really appreciate it!"}`;
  return {
    reply,
    intent: last.includes("?") ? "question" : "other",
    confidence: "low",
    needs_attention: false,
    rationale: "Offline placeholder draft (OPENAI_API_KEY not set).",
    model: "offline-stub",
  };
}
