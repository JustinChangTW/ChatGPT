'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type DomainStat = { domain: string; accuracy: number };

export function DomainPerformanceChart({ data }: { data: DomainStat[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="domain" hide />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="accuracy" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
