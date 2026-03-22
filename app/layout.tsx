import './globals.css';
import { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import packageJson from '@/package.json';

export const metadata = {
  title: 'C|CT Practice App',
  description: 'EC-Council C|CT 題庫練習平台'
};

const buildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version,
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString()
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <AppShell buildInfo={buildInfo}>{children}</AppShell>
      </body>
    </html>
  );
}
