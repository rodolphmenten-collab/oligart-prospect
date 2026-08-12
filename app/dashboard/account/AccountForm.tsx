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
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordError('Les mots de passe ne correspondent pas.');
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
        &larr; Retour au dashboard
      </Link>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-brass">Compte</p>
      <h1 className="mt-2 font-display text-3xl italic text-bone">Identifiants de connexion.</h1>
      <p className="mt-2 text-sm text-bone-dim">
        Email de connexion actuel : <span className="text-bone">{email}</span>
      </p>

      <div className="mt-10 rounded-2xl border hairline p-6">
        <p className="text-sm text-bone">Changer d'email</p>
        <p className="mt-1 text-xs text-bone-faint">
          Nous enverrons un lien de confirmation à la nouvelle adresse avant que le
          changement ne prenne effet.
        </p>
        <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            placeholder="nouvel-email@exemple.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <Button type="submit" disabled={emailStatus === 'saving'} variant="outline" className="w-full">
            {emailStatus === 'saving' ? 'Envoi…' : 'Mettre à jour l\'email'}
          </Button>
          {emailStatus === 'sent' && (
            <p className="text-xs text-signal-live">Vérifiez {newEmail} pour confirmer le changement.</p>
          )}
          {emailStatus === 'error' && <p className="text-xs text-red-400">{emailError}</p>}
        </form>
      </div>

      <div className="mt-6 rounded-2xl border hairline p-6">
        <p className="text-sm text-bone">Changer de mot de passe</p>
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            required
            minLength={8}
            placeholder="Nouveau mot de passe (min. 8 caractères)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <input
            type="password"
            required
            placeholder="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <Button type="submit" disabled={passwordStatus === 'saving'} variant="outline" className="w-full">
            {passwordStatus === 'saving' ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}
          </Button>
          {passwordStatus === 'saved' && <p className="text-xs text-signal-live">Mot de passe mis à jour.</p>}
          {passwordStatus === 'error' && <p className="text-xs text-red-400">{passwordError}</p>}
        </form>
      </div>
    </main>
  );
}
