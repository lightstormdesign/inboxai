import Link from "next/link";
import { brand } from "@/lib/brand";

const features = [
  {
    title: "One inbox for DMs and comments",
    body: "Instagram and Facebook messages and comments land in a single feed sorted by recency — no more hopping between apps.",
  },
  {
    title: "Drafts in your voice",
    body: "Tell us how you talk, share a few past replies, add your FAQs. Every message arrives with a suggested reply that sounds like you.",
  },
  {
    title: "You're always in control",
    body: "Nothing is ever sent automatically. Review, edit, and tap send — or discard. Complaints and tricky questions get flagged for a closer look.",
  },
  {
    title: "Moderate in one tap",
    body: "Hide or delete spam comments right from the inbox, and move public conversations into DMs with a private reply.",
  },
  {
    title: "Post & schedule",
    body: "Publish or schedule Instagram posts, stories and reels and Facebook Page posts right from your inbox. Already use Buffer? Connect it too.",
  },
  {
    title: "Built for small teams",
    body: "Coaches, creators, local shops and small brands — anyone spending hours a day answering the same questions.",
  },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <div>
      {deleted && (
        <p className="bg-emerald-50 py-2 text-center text-sm text-emerald-800">
          Your account and all associated data have been deleted.
        </p>
      )}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          For creators & small businesses
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{brand.tagline}</h1>
        <p className="mt-5 text-lg text-zinc-600">
          {brand.name} brings your Instagram and Facebook DMs and comments into one inbox and drafts a reply to each one in your
          brand&apos;s voice. You review, tweak, and send — in seconds instead of hours.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
            Start free
          </Link>
          <Link href="/login" className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium hover:bg-zinc-50">
            Log in
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-sm leading-6 text-zinc-600">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">How {brand.name} uses your data</h2>
        <p>
          When you connect your Facebook Page and Instagram professional account (through Facebook Login for Business),{" "}
          {brand.name} reads the direct messages and comments on those accounts so it can show them in your inbox and draft replies. Message
          text is sent to our AI provider solely to generate a suggested reply. Replies and posts are only ever published
          when you press Send or Publish. You can disconnect at any time and request deletion of all data — see our{" "}
          <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link> and{" "}
          <Link href="/data-deletion" className="text-brand-600 underline">data deletion instructions</Link>.
        </p>
      </section>
    </div>
  );
}
