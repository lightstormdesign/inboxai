"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions";
import { Field, FormMessage, SubmitButton, inputCls } from "@/components/form";

export default function SignupPage() {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <FormMessage state={state} />
      <Field label="Your name"><input name="name" required className={inputCls} /></Field>
      <Field label="Business or creator name"><input name="business" required className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" autoComplete="email" required className={inputCls} /></Field>
      <Field label="Password" hint="At least 10 characters">
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={inputCls} />
      </Field>
      <SubmitButton className="w-full">Create account</SubmitButton>
      <p className="text-center text-xs text-zinc-500">
        By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
      <p className="text-center text-sm text-zinc-500">
        Have an account? <Link href="/login" className="text-brand-600">Log in</Link>
      </p>
    </form>
  );
}
