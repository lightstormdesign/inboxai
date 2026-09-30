import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dataDeletionRequests } from "@/db/schema";

export const metadata: Metadata = { title: "Deletion Status" };

export default async function DeletionStatusPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const [req] = code
    ? await db.select().from(dataDeletionRequests).where(eq(dataDeletionRequests.confirmationCode, code))
    : [];

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">Data deletion status</h1>
      <form className="mt-6 flex gap-2">
        <input
          name="code"
          defaultValue={code}
          placeholder="Confirmation code"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
        />
        <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">Check</button>
      </form>
      {code && !req && <p className="mt-6 text-red-600">No request found for that code.</p>}
      {req && (
        <dl className="mt-6 space-y-2 rounded-xl border border-zinc-200 bg-white p-5 text-sm">
          <div className="flex justify-between"><dt className="text-zinc-500">Code</dt><dd className="font-mono">{req.confirmationCode}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Status</dt><dd className="font-medium capitalize">{req.status}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Requested</dt><dd>{req.requestedAt.toUTCString()}</dd></div>
          {req.completedAt && (
            <div className="flex justify-between"><dt className="text-zinc-500">Completed</dt><dd>{req.completedAt.toUTCString()}</dd></div>
          )}
          {req.detail && <p className="pt-2 text-zinc-600">{req.detail}</p>}
        </dl>
      )}
    </div>
  );
}
