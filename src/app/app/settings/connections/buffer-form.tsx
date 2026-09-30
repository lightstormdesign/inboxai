"use client";

import { useActionState } from "react";
import { connectBufferAction } from "@/app/actions";
import { FormMessage, SubmitButton, inputCls } from "@/components/form";

export function BufferConnectForm() {
  const [state, action] = useActionState(connectBufferAction, undefined);
  return (
    <form action={action} className="mt-3 space-y-3">
      <p className="text-sm text-zinc-600">
        Buffer currently connects with a personal API key. In Buffer, open <strong>Settings → API</strong>, create a
        key, and paste it here. We store it encrypted and only use it to create posts you schedule.
      </p>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <input name="apiKey" type="password" placeholder="Buffer API key" className={inputCls} autoComplete="off" />
        <SubmitButton pendingText="Checking…">Connect</SubmitButton>
      </div>
    </form>
  );
}
