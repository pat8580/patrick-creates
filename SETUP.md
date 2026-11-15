# Sites by Patrick — launch setup

The Site is published privately. The page and durable enquiry saving work. Email and WhatsApp notifications are pending, not live.

## Content needed

Replace the three clearly labeled illustrative concept designs with Patrick's actual screenshots, project names, service types, short briefs, and links. Do not add results without verified figures.

## Email (Resend)

Connect a Resend account with a verified sending domain. Configure these Sites runtime values server-side:

- `RESEND_API_KEY` (secret)
- `EMAIL_FROM` (verified sender address)
- `PATRICK_EMAIL` (notification recipient)
- `RESEND_WEBHOOK_SECRET` (secret from the Resend webhook settings)

Configure Resend's signed webhook at `/api/webhooks/email` for delivered, bounced, failed, and complained events. The full enquiry is sent as plain text, with the lead's email as Reply-To. Provider acceptance is recorded separately from confirmed delivery.

## WhatsApp Business (Meta Cloud API)

Connect a Meta Business account with WhatsApp Cloud API enabled and a registered sending phone number. Patrick's receiving number must include its country code and be eligible to receive the notification.

Configure:

- `WHATSAPP_ACCESS_TOKEN` (secret, production system-user token with messaging access)
- `WHATSAPP_PHONE_NUMBER_ID` (Meta sending phone ID)
- `PATRICK_WHATSAPP` (recipient number, country code and digits)
- `WHATSAPP_TEMPLATE_NAME` (approved notification template name)
- `WHATSAPP_TEMPLATE_LANGUAGE` (approved language code, defaults to `en`)
- `META_APP_SECRET` (secret for webhook signature validation)
- `WHATSAPP_VERIFY_TOKEN` (secret for webhook verification)

Approve a body template with exactly three text variables in this order: lead name, requested service, preferred reply channel. Example: “New project enquiry from {{1}}. Service: {{2}}. Preferred reply: {{3}}.” Subscribe the app to messages/status webhooks at `/api/webhooks/whatsapp` to track sent, delivered, read, and failed states.

## Retry delivery

Each lead has a unique UUID and submission timestamp. Client retries retain the UUID. Lead and two notification jobs are inserted atomically with conflict protection. Failed notification jobs retry independently with exponential backoff and a maximum of eight delivery attempts. Email uses a stable provider idempotency key. WhatsApp retries can occasionally send duplicate notifications after an ambiguous network failure, but do not duplicate the lead.

The Worker exports a scheduled handler, but no timer has been connected yet. After provider setup, configure an approved recurring invocation, or call `POST /api/notifications/retry` from a trusted scheduler with `Authorization: Bearer <RETRY_SECRET>`; store `RETRY_SECRET` in Sites as a secret. Never expose it to browser code. Monitor exhausted jobs and provider webhooks. A process interrupted while status is `sending` requires investigation before retrying to avoid an unnecessary duplicate notification.

## Verification before live automation

One clearly labeled test lead was saved and read back from the deployed database. Both notification rows are pending because destinations and credentials were not supplied. No email or WhatsApp receipt has been confirmed.

After connecting both providers, deploy to apply runtime values, submit a fresh test, confirm the database contains one lead and two independent notification records, and confirm actual receipt in both Patrick's inbox and WhatsApp. Test a failed notification and its retry without another lead being created. Only then describe the automation as live.

The Site remains owner-private by default. Public launch requires changing its audience and checking webhook reachability, because provider webhooks cannot pass an owner-private sign-in gate. Add anti-abuse controls appropriate to public traffic before broad promotion.

## Checks

`node --test test.mjs` checks submission validation and atomic lead/job saves. `node build.mjs` creates the Worker bundle with local portrait assets embedded. Browser QA was unavailable because the managed browser control runtime was not installed.
