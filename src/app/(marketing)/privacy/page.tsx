import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

/*
 * DRAFT — written to satisfy Meta Platform Terms §3 / App Review requirements
 * and common US/EU expectations. Have counsel review before launch.
 */
export default function PrivacyPage() {
  const b = brand;
  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-zinc-500">Effective {b.legalEffectiveDate}</p>

      <p>
        This Privacy Policy explains how {b.company} (&quot;we&quot;, &quot;us&quot;) collects, uses, shares, and
        protects information when you use {b.name} (the &quot;Service&quot;), including information we receive from
        Meta Platforms (Instagram and Facebook) when you connect your accounts.
      </p>

      <h2>1. Who this applies to</h2>
      <ul>
        <li><strong>Customers</strong> — businesses and creators who sign up for {b.name} and connect their accounts.</li>
        <li>
          <strong>Their audience</strong> — people who send direct messages to, or comment on posts of, a customer&apos;s
          Instagram professional account. We process this information on behalf of our customers.
        </li>
      </ul>

      <h2>2. Information we collect</h2>
      <h3>Account information</h3>
      <p>Your name, email address, business name, and a securely hashed password.</p>
      <h3>Voice profile</h3>
      <p>
        Information you choose to provide about your business so drafts sound like you: brand voice description, sample
        messages, FAQs, and links.
      </p>
      <h3>Information from Meta (Instagram / Facebook)</h3>
      <p>When you connect via Facebook Login for Business and grant permission, we receive:</p>
      <table>
        <thead>
          <tr><th>Data</th><th>Why</th><th>Permission</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Your Facebook user ID, the Pages you manage, and their linked Instagram professional accounts (ID, username, profile picture)</td>
            <td>To let you choose which account to connect and to label it in the app</td>
            <td>pages_show_list, business_management, instagram_basic</td>
          </tr>
          <tr>
            <td>Page access tokens</td>
            <td>To act on your behalf when you press Send, hide, or delete. Stored encrypted (AES-256-GCM).</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Instagram direct messages sent to and from your account, with sender ID, username and name</td>
            <td>To display conversations in your inbox and draft replies</td>
            <td>instagram_manage_messages</td>
          </tr>
          <tr>
            <td>Comments (and replies) on your Instagram posts, with commenter username, plus the post caption and link</td>
            <td>To display comments, draft replies, and let you reply, hide, or delete them</td>
            <td>instagram_manage_comments, pages_read_engagement</td>
          </tr>
          <tr>
            <td>Facebook Messenger messages sent to and from your Page, with the sender&apos;s Page-scoped ID and name</td>
            <td>To display Page conversations in your inbox, draft replies, and send the replies you approve</td>
            <td>pages_messaging</td>
          </tr>
          <tr>
            <td>Comments (and replies) on your Facebook Page&apos;s posts, with commenter name, plus the post text and link</td>
            <td>To display comments, draft replies, and let you reply, hide, or delete them</td>
            <td>pages_read_user_content, pages_manage_engagement</td>
          </tr>
          <tr>
            <td>Photos, videos and captions you choose to publish</td>
            <td>To publish or schedule posts, stories and reels to your Instagram account and Facebook Page when you press Publish or Schedule</td>
            <td>instagram_content_publish, pages_manage_posts</td>
          </tr>
          <tr>
            <td>Webhook subscription status for your Page</td>
            <td>To receive new messages and comments in real time</td>
            <td>pages_manage_metadata</td>
          </tr>
        </tbody>
      </table>
      <p>We do not receive or store your Facebook password, and we only access accounts you explicitly select.</p>
      <h3>Buffer</h3>
      <p>
        If you connect Buffer (optional), we store your Buffer access token or API key (encrypted) and use it only to
        create the posts you schedule through {b.name}.
      </p>
      <h3>Usage and technical data</h3>
      <p>
        Basic logs (IP address, browser type, timestamps, error reports) needed to operate and secure the Service, and an
        audit log of actions taken in your workspace (e.g. who sent which reply).
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To provide the Service: show your messages and comments, generate suggested replies, send, hide, or delete content, and publish posts — <strong>only when you tell us to</strong>.</li>
        <li>To secure the Service, prevent abuse, and debug problems.</li>
        <li>To communicate with you about your account and the Service.</li>
      </ul>
      <p>
        We <strong>do not</strong> sell personal information, use Meta Platform Data for advertising, build profiles of
        your audience, or use your or your audience&apos;s data to train AI models. Replies are never sent automatically
        — a person in your workspace must approve each one.
      </p>

      <h2>4. AI processing</h2>
      <p>
        To draft a reply, we send the recent text of that conversation, the post caption (for comments), and your voice
        profile to our AI provider, OpenAI, via its API. OpenAI processes this data as our service provider, and under
        its API terms does not use API data to train its models. We request that responses are not stored for later
        retrieval. Drafts are suggestions shown only to you.
      </p>

      <h2>5. How we share information</h2>
      <p>We share information only with service providers that help us run the Service, under contracts that limit their use of it:</p>
      <ul>
        <li><strong>Vercel</strong> — application hosting</li>
        <li><strong>Our database provider</strong> (managed PostgreSQL) — data storage</li>
        <li><strong>OpenAI</strong> — generating reply drafts</li>
        <li><strong>Meta</strong> — when you send a reply or moderate a comment, we send it to Meta&apos;s API</li>
        <li><strong>Vercel Blob</strong> — storing photos and videos you upload for publishing</li>
        <li><strong>Buffer</strong> — only if you connect it and choose to schedule a post through it</li>
      </ul>
      <p>We may also disclose information if required by law, or to protect the rights and safety of our users or others.</p>

      <h2>6. Retention</h2>
      <ul>
        <li>Messages, comments, and drafts are kept while your account stays connected, so your inbox history works.</li>
        <li>Disconnecting an Instagram account in Settings immediately deletes its access token and all synced messages, comments, and drafts.</li>
        <li>Raw webhook deliveries are deleted after 14 days.</li>
        <li>Media you upload for publishing is kept with the post record and deleted when you delete your account.</li>
        <li>Deleting your account deletes all workspace data immediately; backups roll off within 30 days.</li>
      </ul>

      <h2>7. Your choices and rights</h2>
      <ul>
        <li><strong>Disconnect</strong> any account at any time in Settings → Connections, or remove {b.name} from your Facebook Business Integrations settings.</li>
        <li><strong>Delete</strong> your account and all data in Settings → Account, or follow our <Link href="/data-deletion">data deletion instructions</Link>.</li>
        <li><strong>Access / correction / export</strong> — email <a href={`mailto:${b.privacyEmail}`}>{b.privacyEmail}</a>.</li>
      </ul>
      <p>
        If you messaged or commented on an account that uses {b.name}, that business controls your data; contact them
        directly, or write to us and we will forward your request.
      </p>
      <p>
        Depending on where you live (e.g. the EU/UK under GDPR, or California under CCPA/CPRA) you may have rights to
        access, correct, delete, or port your data, and to object to processing. We honor these requests within 30 days.
      </p>

      <h2>8. Security</h2>
      <p>
        Third-party tokens are encrypted at rest with AES-256-GCM; passwords are hashed with scrypt; all traffic uses
        HTTPS; every call to Meta is signed with an app-secret proof; webhook deliveries are signature-verified; and
        access to production data is limited to authorized personnel.
      </p>

      <h2>9. Children</h2>
      <p>The Service is for businesses and is not directed at children under 16. We do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>We will post updates here and, for material changes, notify account holders by email.</p>

      <h2>11. Contact</h2>
      <p>
        {b.company}
        <br />
        {b.companyAddress}
        <br />
        <a href={`mailto:${b.privacyEmail}`}>{b.privacyEmail}</a>
      </p>
    </article>
  );
}
