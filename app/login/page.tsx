'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/onboarding';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus('error');
      setErrorMsg(data.error ?? 'Something went wrong.');
      return;
    }
    setStatus('sent');
    setCodeSent(true);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus('verifying');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }
    // Verified in-browser — no link click needed, so no cross-browser-context issue.
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Sign in</p>
      <h1 className="mt-4 font-display text-3xl italic text-bone">Enter the room.</h1>
      <p className="mt-3 text-sm text-bone-dim">We&rsquo;ll email you a sign-in code.</p>

      {codeSent ? (
        <form onSubmit={handleVerifyCode} className="mt-8 space-y-4">
          <p className="rounded-2xl border hairline bg-ink-800 p-5 text-sm text-bone-dim">
            Check <span className="text-bone">{email}</span> and enter the code below.
          </p>
          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="Code"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-center text-lg tracking-[0.3em] text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <Button type="submit" disabled={status === 'verifying' || code.length < 6} className="w-full">
            {status === 'verifying' ? 'Verifying…' : 'Continue'}
          </Button>
          {status === 'error' && <p className="text-xs text-red-400">{errorMsg || 'Invalid code — try again.'}</p>}
          <button
            type="button"
            onClick={() => {
              setCodeSent(false);
              setStatus('idle');
              setCode('');
              setErrorMsg('');
            }}
            className="w-full text-center text-xs text-bone-faint underline"
          >
            Use a different email
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendCode} className="mt-8 space-y-4">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <Button type="submit" disabled={status === 'sending'} className="w-full">
            {status === 'sending' ? 'Sending…' : 'Send code'}
          </Button>
          {status === 'error' && (
            <p className="text-xs text-red-400">{errorMsg || 'Something went wrong — try again.'}</p>
          )}
        </form>
      )}
    </main>
  );
}
