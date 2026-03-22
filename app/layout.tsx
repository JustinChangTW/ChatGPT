import './globals.css';
import { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

export const metadata = {
  title: 'C|CT Practice App',
  description: 'EC-Council C|CT 題庫練習平台'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
