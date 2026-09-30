import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Data Deletion Instructions" };

/** Public "Data Deletion Instructions URL" for the Meta app dashboard. */
export default function DataDeletionPage() {
  const b = brand;
  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Data Deletion Instructions</h1>
      <p>You can remove your data from {b.name} at any time using any of these options.</p>

      <h2>Option 1 — Delete from inside {b.name}</h2>
      <ul>
        <li>
          <strong>Disconnect an Instagram account:</strong> Settings → Connections → Disconnect. This immediately deletes
          that account&apos;s access token and every message, comment, and AI draft synced from it.
        </li>
        <li>
          <strong>Delete everything:</strong> Settings → Account → Delete account. This permanently deletes your
          workspace, voice profile, connections, messages, drafts, and scheduled-post records.
        </li>
      </ul>

      <h2>Option 2 — Remove the app from Facebook</h2>
      <ul>
        <li>Go to Facebook → Settings &amp; privacy → Settings → Business integrations (or Apps and websites).</li>
        <li>Find <strong>{b.name}</strong> and click <strong>Remove</strong>, then check the box to delete data.</li>
        <li>
          Facebook notifies us automatically. We delete all data we received for your account and give you a
          confirmation code you can check at <code>/data-deletion/status</code>.
        </li>
      </ul>

      <h2>Option 3 — Email us</h2>
      <p>
        Email <a href={`mailto:${b.privacyEmail}?subject=Data%20deletion%20request`}>{b.privacyEmail}</a> from the address
        on your account (or tell us your Instagram username) and we will delete your data within 30 days and confirm by
        email.
      </p>

      <h2>If you messaged a business that uses {b.name}</h2>
      <p>
        Your messages are controlled by that business. Ask them to delete the conversation, or email us with your
        Instagram username and the business&apos;s handle and we will coordinate deletion.
      </p>
    </article>
  );
}
