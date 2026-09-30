"use client";

import { useActionState, useEffect, useState } from "react";
import { schedulePostAction } from "@/app/actions";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/form";

export function ComposeForm({ channels }: { channels: { id: string; label: string }[] }) {
  const [state, action] = useActionState(schedulePostAction, undefined);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [tzOffset, setTzOffset] = useState(0);
  useEffect(() => setTzOffset(new Date().getTimezoneOffset()), []);
  const label = channels.find((c) => c.id === channelId)?.label ?? "";
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <FormMessage state={state} />
      <input type="hidden" name="channelLabel" value={label} />
      <input type="hidden" name="tzOffset" value={tzOffset} />
      <Field label="Channel">
        <select name="channelId" value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inputCls}>
          {channels.length === 0 && <option value="">No channels found in Buffer</option>}
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Caption">
        <textarea name="text" rows={5} maxLength={2200} className={inputCls} />
      </Field>
      <Field label="Image URL (optional)" hint="Instagram posts need an image. Use a publicly reachable URL.">
        <input name="imageUrl" type="url" className={inputCls} />
      </Field>
      <Field label="When" hint="Leave empty to add to your Buffer queue's next open slot.">
        <input name="dueAt" type="datetime-local" className={inputCls} />
      </Field>
      <SubmitButton pendingText="Scheduling…">Schedule</SubmitButton>
    </form>
  );
}
