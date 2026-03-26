'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

const navItems = [
  ['Dashboard', '/dashboard'],
  ['章節練習', '/practice/chapter'],
  ['正式模擬考', '/exam'],
  ['單字庫', '/vocabulary'],
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 py-3 text-sm sm:gap-4 sm:px-4">
          {navItems.map(([label, href]) => (
            <Link
              key={href}
              className="whitespace-nowrap rounded px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-6 sm:pb-6">{children}</main>
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 text-xs text-slate-500">
          Build: v{buildInfo.version} · {buildInfo.buildTime}
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-2 py-2 backdrop-blur sm:hidden">
        <div className="grid grid-cols-4 gap-1 text-xs">
          {navItems.map(([label, href]) => (
            <Link key={`mobile-${href}`} href={href} className="rounded px-2 py-2 text-center font-medium text-slate-700 hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
