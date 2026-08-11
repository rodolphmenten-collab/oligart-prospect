'use client';

import type { Lang } from '@/lib/i18n/landing';

export function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <button
      onClick={() => onChange(lang === 'en' ? 'fr' : 'en')}
      className="rounded-full border hairline px-3 py-1.5 text-xs tracking-wide text-bone-dim hover:border-brass hover:text-brass"
    >
      {lang === 'en' ? 'FR' : 'EN'}
    </button>
  );
}
