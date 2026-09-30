import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of Service" };

/* DRAFT — have counsel review before launch. */
export default function TermsPage() {
  const b = brand;
  return (
    <article className="prose-legal mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-zinc-500">Effective {b.legalEffectiveDate}</p>

      <p>
        These Terms govern your use of {b.name}, provided by {b.company}. By creating an account you agree to them.
      </p>

      <h2>1. The Service</h2>
      <p>
        {b.name} lets you view and respond to Instagram direct messages and comments, generate AI-suggested replies,
        moderate comments, and schedule posts through Buffer. Features depend on third-party platforms (Meta, OpenAI,
        Buffer) and may change if those platforms change.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18 and authorized to act for the business and social accounts you connect.</li>
        <li>You are responsible for activity in your workspace and for keeping your credentials secure.</li>
      </ul>

      <h2>3. AI-generated drafts</h2>
      <p>
        Drafts are suggestions and may be inaccurate or inappropriate. <strong>You are responsible for reviewing every
        reply before sending it.</strong> {b.name} never sends a reply without your explicit approval.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use {b.name} to:</p>
      <ul>
        <li>send spam, unsolicited bulk messages, or messages outside the windows allowed by Meta&apos;s policies;</li>
        <li>harass, deceive, or discriminate against anyone, or send unlawful content;</li>
        <li>violate the Instagram Terms of Use, Meta Platform Terms, Meta Community Standards, or Buffer&apos;s terms;</li>
        <li>attempt to access data you are not authorized to access or interfere with the Service.</li>
      </ul>

      <h2>5. Your content and data</h2>
      <p>
        You keep all rights to your content. You grant us a limited license to process it only to provide the Service,
        as described in our <Link href="/privacy">Privacy Policy</Link>. You are responsible for having a lawful basis
        to process your audience&apos;s messages through the Service.
      </p>

      <h2>6. Fees</h2>
      <p>Paid plans, if any, are billed as described at signup. You can cancel at any time; fees are non-refundable except where required by law.</p>

      <h2>7. Termination</h2>
      <p>
        You can delete your account at any time. We may suspend accounts that violate these Terms or platform
        policies. On termination we delete your data as described in the Privacy Policy.
      </p>

      <h2>8. Disclaimers & liability</h2>
      <p>
        The Service is provided &quot;as is&quot;. To the maximum extent permitted by law, {b.company} is not liable for
        indirect or consequential damages, or for content you choose to send. Our total liability is limited to the
        amount you paid us in the 12 months before the claim.
      </p>

      <h2>9. Third-party platforms</h2>
      <p>
        {b.name} is not affiliated with, endorsed, or sponsored by Meta, Instagram, OpenAI, or Buffer. Your use of those
        platforms is governed by their own terms.
      </p>

      <h2>10. Changes & contact</h2>
      <p>
        We may update these Terms and will notify you of material changes. Questions:{" "}
        <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>.
      </p>
    </article>
  );
}
