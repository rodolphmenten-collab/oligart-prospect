import type { Metadata, Viewport } from 'next';
import { AuthRecoveryListener } from '@/components/AuthRecoveryListener';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lucky — Meet the people already around you',
  description: 'Dating. Business. Social. Right here, right now.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lucky',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0B0A08',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthRecoveryListener />
        {children}
      </body>
    </html>
  );
}
