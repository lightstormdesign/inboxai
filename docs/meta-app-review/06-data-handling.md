# 06 — Data handling answers

Draft answers for the **Data Use Checkup**, the **Data Protection Assessment
(DPA)** that Meta sends apps with Advanced Access to user data, and the data
questions in the App Review form. Keep them consistent with `/privacy`.

## Data processors / service providers
> Who else will have access to Platform Data?

| Provider | Purpose | Location |
|---|---|---|
| Vercel Inc. | Application hosting and serverless compute | US |
| Neon (via Vercel Marketplace), or your chosen Postgres host | Primary database | US (choose region) |
| OpenAI, L.L.C. | Generating suggested reply text from message content (API; not used for training; `store: false`) | US |
| Vercel Blob (Vercel Inc.) | Stores media the customer uploads for publishing | US |
| Buffer Inc. (optional) | Only receives posts the customer chooses to schedule through Buffer. **No Meta Platform Data (messages, comments, profiles) is sent to Buffer.** | US |

## Responsible entity
LightStorm Design LLC, <country of registration: United States>.

## Data security questions (DPA)

**Do you have a policy or process for handling Platform Data securely?**
Yes. Summary:
- **Encryption in transit:** HTTPS/TLS 1.2+ everywhere (Vercel), and TLS to the database.
- **Encryption at rest:** Meta access tokens and Buffer API keys are encrypted at the
  application layer with AES-256-GCM (`src/lib/crypto.ts`). The database volume is
  encrypted at rest by the provider.
- **Access control:** production access is limited to the founder, with MFA on Vercel,
  the database provider, GitHub, Meta, and OpenAI. No shared credentials.
- **Tenant isolation:** every query is scoped by workspace ID; tokens never reach the browser.
- **API hygiene:** `appsecret_proof` on every Graph call, "Require App Secret" enabled,
  webhook payloads verified with `X-Hub-Signature-256`, and signed_request verified on
  deauthorize and deletion callbacks.
- **Least privilege:** only the permissions listed in doc 02 are requested.
- **Audit log:** reply sends, moderation actions, connects, and disconnects are logged with the acting user.
- **Secrets:** environment variables in Vercel only; key rotation supported (`TOKEN_ENCRYPTION_KEY_PREVIOUS`).
- **Vulnerability management:** dependencies are updated via Dependabot/Renovate, and
  security patches are applied within 7 days (critical within 48h).

**Incident response.** On a suspected breach: revoke the affected tokens (mark the
connections revoked), rotate app secrets and keys, and notify affected customers and
Meta without undue delay (within 72h where GDPR applies).

**Do you store Platform Data on personal devices?** No. Data lives only in the
production database; no exports to local machines.

**Data retention and deletion.**
- Messages, comments, and drafts are kept while the connection is active.
- Disconnect → the connection, its token, and all its threads/messages/drafts are deleted immediately (FK cascade).
- Account deletion → the whole workspace is deleted immediately.
- Raw webhook payloads are purged after 14 days (cron).
- Meta deauthorize callback → tokens are wiped immediately.
- Meta data deletion callback → all data for that FB user's connections is deleted
  immediately, with a confirmation code and status URL.

**Do you use Platform Data for purposes other than the app's functionality?**
No: no advertising, no selling or licensing, no profiling, no model training, and no
sharing beyond the processors above.

**Is Platform Data used to train AI models?** No. Message text is sent to OpenAI's API
only to generate that conversation's suggested reply. OpenAI does not train on API
data by default, and we set `store: false`.

## Data Use Checkup (annual)

For each permission, confirm usage matches doc 02. Put a yearly reminder on the
calendar. Missing the checkup deadline revokes access.
