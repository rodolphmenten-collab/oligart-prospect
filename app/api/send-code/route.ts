import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  const service = createServiceClient();

  // Ask Supabase's own auth system to generate a real OTP for this email — we just
  // don't let Supabase send the email itself (that's the part whose template kept
  // failing to save). `email_otp` is the same 6-digit code verifyOtp() expects.
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { shouldCreateUser: true },
  });

  if (error || !data?.properties?.email_otp) {
    return NextResponse.json({ error: error?.message ?? 'Could not generate code' }, { status: 400 });
  }

  const code = data.properties.email_otp;
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return NextResponse.json({ error: 'Email sending is not configured (missing RESEND_API_KEY).' }, { status: 500 });
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Lucky <${fromAddress}>`,
      to: email,
      subject: `Your Lucky sign-in code: ${code}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
          <p style="color:#8A8478; font-size:12px; letter-spacing:2px; text-transform:uppercase;">Sign in</p>
          <h1 style="color:#0B0A08; font-size:24px;">Your code</h1>
          <p style="font-size:32px; font-weight:600; letter-spacing:8px; color:#0B0A08;">${code}</p>
          <p style="color:#666; font-size:13px;">This code expires shortly and can only be used once.</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const errBody = await emailRes.text();
    return NextResponse.json({ error: `Email failed to send: ${errBody}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
