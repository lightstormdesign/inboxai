/**
 * Single source of truth for product naming. "InboxAI" is a working name —
 * rename here (and in docs/) once a final name is picked. See docs/naming.md.
 *
 * Meta brand rules: the product name must NOT contain "Insta", "Gram",
 * "Facebook", "FB", "Meta" or look like a Meta product.
 */
export const brand = {
  name: "InboxAI",
  tagline: "Every DM and comment answered — in your voice.",
  company: "LightStorm Design LLC",
  companyAddress: "[Registered business address — fill in before submission]",
  get supportEmail() {
    return process.env.SUPPORT_EMAIL ?? "support@example.com";
  },
  get privacyEmail() {
    return process.env.PRIVACY_EMAIL ?? "privacy@example.com";
  },
  legalEffectiveDate: "October 1, 2026",
};
