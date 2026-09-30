"use client";

import { useActionState } from "react";
import { saveVoiceAction } from "@/app/actions";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/form";
import type { FaqEntry } from "@/db/schema";

export type VoiceValues = {
  businessName: string;
  whatWeDo: string;
  audience: string;
  tone: string;
  dos: string;
  donts: string;
  emojiStyle: string;
  signOff: string;
  links: string;
  samples: string[];
  faq: FaqEntry[];
};

export function VoiceForm({ values, next, submitLabel = "Save voice profile" }: { values: VoiceValues; next?: string; submitLabel?: string }) {
  const [state, action] = useActionState(saveVoiceAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <Field label="Business / creator name">
        <input name="businessName" defaultValue={values.businessName} className={inputCls} />
      </Field>
      <Field label="What you do" hint="A few sentences: what you offer, where, price range, how people book or buy.">
        <textarea name="whatWeDo" defaultValue={values.whatWeDo} rows={3} className={inputCls} />
      </Field>
      <Field label="Who your audience is">
        <input name="audience" defaultValue={values.audience} placeholder="e.g. busy parents in Austin, beginner runners" className={inputCls} />
      </Field>
      <Field label="Your voice & tone" hint="How do you sound? e.g. “warm, playful, a little cheeky; short sentences; never corporate”.">
        <textarea name="tone" defaultValue={values.tone} rows={2} className={inputCls} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Always…" hint="e.g. thank people by name, point bookings to the link">
          <textarea name="dos" defaultValue={values.dos} rows={3} className={inputCls} />
        </Field>
        <Field label="Never…" hint="e.g. quote prices publicly, promise delivery dates">
          <textarea name="donts" defaultValue={values.donts} rows={3} className={inputCls} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Emoji style">
          <select name="emojiStyle" defaultValue={values.emojiStyle} className={inputCls}>
            <option value="none">No emoji</option>
            <option value="sparingly">Sparingly (0–1 per message)</option>
            <option value="freely">Freely — we love emoji ✨</option>
          </select>
        </Field>
        <Field label="DM sign-off (optional)">
          <input name="signOff" defaultValue={values.signOff} placeholder="e.g. — Sam @ Sunny Studio" className={inputCls} />
        </Field>
      </div>
      <Field label="Links the AI may share" hint="One per line, with a label. e.g. “Booking: https://…”">
        <textarea name="links" defaultValue={values.links} rows={2} className={inputCls} />
      </Field>
      <Field
        label="Sample replies & posts in your own words"
        hint="Paste 3–8 real messages or captions you've written. Separate each with a line containing ---"
      >
        <textarea name="samples" defaultValue={values.samples.join("\n---\n")} rows={8} className={`${inputCls} font-mono text-xs`} />
      </Field>
      <Field
        label="FAQ — facts the AI is allowed to use"
        hint={<>Format: <code>Q: …</code> then <code>A: …</code>, blank line between entries. Drafts will not state facts that aren&apos;t here.</>}
      >
        <textarea
          name="faq"
          defaultValue={values.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}
          rows={8}
          className={`${inputCls} font-mono text-xs`}
        />
      </Field>
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
