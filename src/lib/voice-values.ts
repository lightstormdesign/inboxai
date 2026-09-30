import { eq } from "drizzle-orm";
import { db } from "@/db";
import { voiceProfiles } from "@/db/schema";
import type { VoiceValues } from "@/components/voice-form";

export async function loadVoiceValues(workspaceId: string, fallbackName: string): Promise<VoiceValues> {
  const [v] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.workspaceId, workspaceId));
  return {
    businessName: v?.businessName || fallbackName,
    whatWeDo: v?.whatWeDo ?? "",
    audience: v?.audience ?? "",
    tone: v?.tone ?? "",
    dos: v?.dos ?? "",
    donts: v?.donts ?? "",
    emojiStyle: v?.emojiStyle ?? "sparingly",
    signOff: v?.signOff ?? "",
    links: v?.links ?? "",
    samples: v?.samples ?? [],
    faq: v?.faq ?? [],
  };
}
