import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Module scope, reused across warm Lambda invocations (same rationale as the other clients).
const client = new SESClient({ region: process.env.AWS_REGION });

/**
 * Sends a transactional HTML email from the verified `SES_FROM_EMAIL` address. Used by the
 * auth module (password reset, email verification) and — once built — comment alerts and
 * the newsletter (see docs/workflows.md).
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await client.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL!,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  }));
}
