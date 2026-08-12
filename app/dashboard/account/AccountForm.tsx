'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function AccountForm({ email }: { email: string }) {
  const supabase = createClient();

  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState('');

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus('saving');
    setEmailError('');
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailStatus('error');
      setEmailError(error.message);
      return;
    }
    setEmailStatus('sent');
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordStatus('error');
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordError('Passwords don\u2019t match.');
      return;
    }
    setPasswordStatus('saving');
    setPasswordError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordStatus('error');
      setPasswordError(error.message);
      return;
    }
    setPasswordStatus('saved');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <Link href="/dashboard" className="text-xs text-bone-faint hover:text-bone-dim">
        &larr; Back to dashboard
      </Link>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-brass">Account</p>
      <h1 className="mt-2 font-display text-3xl italic text-bone">Login details.</h1>
      <p className="mt-2 text-sm text-bone-dim">
        Current login email: <span className="text-bone">{email}</span>
      </p>

      <div className="mt-10 rounded-2xl border hairline p-6">
        <p className="text-sm text-bone">Change email</p>
        <p className="mt-1 text-xs text-bone-faint">
          We&rsquo;ll send a confirmation link to the new address before the change takes effect.
        </p>
        <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            placeholder="new-email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <Button type="submit" disabled={emailStatus === 'saving'} variant="outline" className="w-full">
            {emailStatus === 'saving' ? 'Sending\u2026' : 'Update email'}
          </Button>
          {emailStatus === 'sent' && (
            <p className="text-xs text-signal-live">Check {newEmail} to confirm the change.</p>
          )}
          {emailStatus === 'error' && <p className="text-xs text-red-400">{emailError}</p>}
        </form>
      </div>

      <div className="mt-6 rounded-2xl border hairline p-6">
        <p className="text-sm text-bone">Change password</p>
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            required
            minLength={8}
            placeholder="New password (min. 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <input
            type="password"
            required
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <Button type="submit" disabled={passwordStatus === 'saving'} variant="outline" className="w-full">
            {passwordStatus === 'saving' ? 'Saving\u2026' : 'Update password'}
          </Button>
          {passwordStatus === 'saved' && <p className="text-xs text-signal-live">Password updated.</p>}
          {passwordStatus === 'error' && <p className="text-xs text-red-400">{passwordError}</p>}
        </form>
      </div>
    </main>
  );
}
