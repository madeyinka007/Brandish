import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Module scope, reused across warm Lambda invocations (same rationale as the other clients).
const client = new SESClient({ region: process.env.AWS_REGION });

// LOCAL-DEV FALLBACK — set `EMAIL_TRANSPORT=console` to log outbound mail to the console
// instead of sending via SES. Lets flows that email (user invite/verification, password reset)
// work locally with no AWS/SES. Anything else (or unset) uses real SES. Must stay unset in
// production. Same spirit as `AUTH_STORE=memory` for the refresh-token store.
const TRANSPORT = process.env.EMAIL_TRANSPORT ?? 'ses';

/**
 * Sends a transactional HTML email from the verified `SES_FROM_EMAIL` address. Used by the
 * auth module (password reset, email verification) and — once built — comment alerts and
 * the newsletter (see docs/workflows.md).
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (TRANSPORT === 'console') {
    // eslint-disable-next-line no-console
    console.log(`[email:console] would send → to=${to} | subject=${subject}\n${html}`);
    return;
  }
  await client.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL!,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  }));
}
