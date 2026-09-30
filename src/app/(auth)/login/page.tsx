"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/form";

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-semibold">Log in</h1>
      <FormMessage state={state} />
      <Field label="Email"><input name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
      <Field label="Password"><input name="password" type="password" autoComplete="current-password" required className={inputCls} /></Field>
      <SubmitButton className="w-full">Log in</SubmitButton>
      <p className="text-center text-sm text-zinc-500">
        New here? <Link href="/signup" className="text-brand-600">Create an account</Link>
      </p>
    </form>
  );
}
