'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

const navItems = [
  ['Dashboard', '/dashboard'],
  ['章節練習', '/practice/chapter'],
  ['正式模擬考', '/exam'],
  ['錯題本', '/wrong-notebook'],
  ['歷史分析', '/history'],
  ['Admin', '/admin']
];

export function AppShell({
  children,
  buildInfo
}: {
  children: ReactNode;
  buildInfo: { version: string; buildTime: string };
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl gap-4 px-4 py-3 text-sm">
          {navItems.map(([label, href]) => (
            <Link key={href} className="rounded px-2 py-1 hover:bg-slate-100" href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 text-xs text-slate-500">
          Build: v{buildInfo.version} · {buildInfo.buildTime}
        </div>
      </footer>
    </div>
  );
}
