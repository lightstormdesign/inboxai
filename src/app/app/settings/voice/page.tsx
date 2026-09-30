import type { Metadata } from "next";
import { VoiceForm } from "@/components/voice-form";
import { requireAuth } from "@/lib/auth";
import { loadVoiceValues } from "@/lib/voice-values";

export const metadata: Metadata = { title: "Brand voice" };

export default async function VoicePage() {
  const { workspace } = await requireAuth();
  const values = await loadVoiceValues(workspace.id, workspace.name);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Brand voice</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        This is what makes drafts sound like you. It&apos;s included with every draft request — the more specific, the
        better. Changes apply to new drafts; hit “New draft” on a conversation to redraft it.
      </p>
      <VoiceForm values={values} />
    </div>
  );
}
