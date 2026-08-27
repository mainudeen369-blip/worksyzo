import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/session';
import { ThemeToggle } from '@/lib/theme-toggle';

export const metadata: Metadata = {
  title: 'Worksyzo — Private AI employee for your organization',
  description:
    'Knowledge + Memory + Work + Actions. Multi-tenant B2B SaaS by Hapyzo Technologies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <SessionProvider>
          {children}
          <ThemeToggle />
        </SessionProvider>
      </body>
    </html>
  );
}
