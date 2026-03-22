import { ReactNode } from 'react';

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
