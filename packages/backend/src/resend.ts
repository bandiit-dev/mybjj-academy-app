import { Resend } from "resend";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getResendClient(): { resend: Resend; fromEmail: string } {
  const apiKey = requireEnv("RESEND_API_KEY");
  const fromEmail = requireEnv("RESEND_FROM_EMAIL");

  return {
    resend: new Resend(apiKey),
    fromEmail,
  };
}

export async function sendSystemEmail({
  idempotencyKey,
  ...message
}: {
  to: string;
  subject: string;
  idempotencyKey?: string;
} & ({ html: string; text?: string } | { html?: string; text: string })) {
  const { resend, fromEmail } = getResendClient();

  return resend.emails.send(
    { ...message, from: fromEmail },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}
