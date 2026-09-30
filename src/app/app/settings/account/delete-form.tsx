"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/actions";
import { FormMessage, inputCls } from "@/components/form";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, undefined);
  return (
    <form action={action} className="mt-4 space-y-3">
      <FormMessage state={state} />
      <input name="confirm" placeholder="Type DELETE to confirm" className={inputCls} autoComplete="off" />
      <button disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
        {pending ? "Deleting…" : "Delete my account and all data"}
      </button>
    </form>
  );
}
