import type { Metadata } from "next";
import Link from "next/link";
import { VoiceForm } from "@/components/voice-form";
import { requireAuth } from "@/lib/auth";
import { loadVoiceValues } from "@/lib/voice-values";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const { workspace, user } = await requireAuth();
  const values = await loadVoiceValues(workspace.id, workspace.name);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm font-medium text-brand-600">Step 1 of 2 · Your voice</p>
      <h1 className="mt-1 text-2xl font-semibold">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}! Teach us how you talk.</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        Takes about 3 minutes. Every reply we draft will use this — you can refine it anytime under Brand voice.
      </p>
      <VoiceForm values={values} next="/app/settings/connections?onboarding=1" submitLabel="Save & continue →" />
      <p className="mt-4 text-center text-sm">
        <Link href="/app/settings/connections?onboarding=1" className="text-zinc-500 underline">Skip for now</Link>
      </p>
    </div>
  );
}
