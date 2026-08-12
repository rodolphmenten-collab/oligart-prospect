/**
 * Sends an email directly via Resend's API — not through Supabase's own email
 * templates. This keeps deliverability and personalization fully in our control
 * (see /api/send-code for the original reasoning: Supabase's dashboard template
 * editor was unreliable, and its default emails deliver poorly).
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!resendApiKey) {
    return { ok: false, error: 'Missing RESEND_API_KEY' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Lucky <${fromAddress}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body };
  }

  return { ok: true };
}

/**
 * A simple branded HTML wrapper so every email we send looks consistent and
 * legitimate (a real footer/address helps deliverability too, not just polish).
 */
export function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <p style="color:#B08D57; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin: 0 0 16px;">Lucky</p>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
      <p style="color:#999; font-size:11px; line-height:1.5;">
        Lucky — the social network of the place you're in.<br />
        You're receiving this because an account or venue was set up for you on lucky-app.io.
      </p>
    </div>
  `;
}
