import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Prefer the public site URL over the request's own origin. On some hosts
  // (e.g. Netlify's serverless/edge runtime), request.url can reflect an internal
  // deploy hostname rather than the public domain, which would otherwise send
  // users to the wrong (and unlisted) redirect target after login.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  return NextResponse.redirect(`${baseUrl}${next}`);
}
