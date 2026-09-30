# 05 — Business verification (LightStorm Design LLC)

Tech Providers need a **verified business** before Advanced Access permissions
work for the public. Start this on day one, because it runs in parallel with development.

## Steps

1. business.facebook.com → **Settings → Business info / Security Center → Start verification**.
2. Enter the legal details **exactly** as they appear on your formation documents:
   - Legal name: **LightStorm Design LLC**
   - Address: registered business address. It must match the documents; a PO box usually fails.
   - Phone number: one you can answer, or receive a call/SMS on.
   - Website: your product domain, with the privacy policy live.
3. Upload **one** document that shows the legal name and address, for example:
   - Articles of Organization / Certificate of Formation (state-issued)
   - IRS EIN confirmation letter (CP 575 or 147C)
   - A business utility bill or bank statement with the name and address
   - Business license
4. Verify control of the business by **email on your domain** (easiest; needs
   an address like `admin@<yourdomain>.com`), phone, or DNS TXT record.
5. Wait for the decision. It can take a few days to a couple of weeks.

## Make it go smoothly

- Your website footer should show "© LightStorm Design LLC". It already does
  via `brand.company` in `src/lib/brand.ts`.
- Fill in `brand.companyAddress` in `src/lib/brand.ts` so the privacy policy shows the same address.
- The domain registrant, website, and email domain should all line up.
- Keep the Business portfolio's name as the legal name. A trading name can go in "DBA".

## After verification

- Link the app to the verified business: App settings → Basic → **Business portfolio**.
- In App Review, "Business verification" should show a green check before you submit.
- Optional, and useful later: complete **Access Verification** as a Tech Provider if the dashboard asks for it.
