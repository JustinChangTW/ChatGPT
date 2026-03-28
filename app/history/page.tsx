'use client';

import { useMemo } from 'react';
import { loadPracticeAttempts } from '@/lib/services/practice-attempt-storage';

export default function HistoryPage() {
  const records = useMemo(() => loadPracticeAttempts(), []);
  const summary = useMemo(() => {
    if (records.length === 0) return null;
    const best = Math.max(...records.map((r) => r.score));
    const avg = Number((records.reduce((acc, r) => acc + r.score, 0) / records.length).toFixed(2));
    return { best, avg };
  }, [records]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History / Analytics</h1>
      {summary ? (
        <div className="rounded border bg-white p-3 text-sm">
          <p>總測驗次數：{records.length}</p>
          <p>平均分數：{summary.avg}</p>
          <p>最高分數：{summary.best}</p>
        </div>
      ) : (
        <p className="rounded border bg-white p-3 text-sm">尚無歷史紀錄。先完成章節練習並交卷。</p>
      )}
      <ul className="space-y-2">
        {records.map((r) => (
          <li key={r.id} className="rounded border bg-white p-3">
            <p className="text-sm text-slate-500">{new Date(r.submittedAt).toLocaleString()}</p>
            <p className="font-medium break-words">
              {r.mode} · score {r.score} · accuracy {r.accuracy}% · {r.correctCount}/{r.totalQuestions}
            </p>
            {r.selectedChapter ? <p className="text-sm text-slate-600">章節：{r.selectedChapter}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
