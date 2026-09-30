import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { DeleteAccountForm } from "./delete-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user, workspace, role } = await requireAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">Account</h1>
      <dl className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5 text-sm">
        <div className="flex justify-between"><dt className="text-zinc-500">Name</dt><dd>{user.name}</dd></div>
        <div className="flex justify-between"><dt className="text-zinc-500">Email</dt><dd>{user.email}</dd></div>
        <div className="flex justify-between"><dt className="text-zinc-500">Workspace</dt><dd>{workspace.name}</dd></div>
        <div className="flex justify-between"><dt className="text-zinc-500">Role</dt><dd className="capitalize">{role}</dd></div>
      </dl>
      <section className="rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold text-red-700">Delete account</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Permanently deletes your workspace, voice profile, connected accounts (and their access tokens), every synced
          message, comment and draft, and scheduled-post records. This cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
