'use client';

import { useMemo, useState } from 'react';
import {
  VocabularyEntry,
  clearVocabularyBank,
  loadVocabularyBank,
  removeVocabularyEntry
} from '@/lib/services/vocabulary-storage';

export default function VocabularyPage() {
  const [entries, setEntries] = useState<VocabularyEntry[]>(loadVocabularyBank());
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const reviewList = useMemo(
    () => [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries]
  );
  const current = reviewList[reviewIndex] ?? null;

  const nextCard = () => {
    if (reviewList.length === 0) return;
    setReviewIndex((idx) => (idx + 1) % reviewList.length);
    setRevealed(false);
  };

  const deleteEntry = (id: string) => {
    const next = removeVocabularyEntry(id);
    setEntries(next);
    setReviewIndex(0);
    setRevealed(false);
  };

  const clearAll = () => {
    const next = clearVocabularyBank();
    setEntries(next);
    setReviewIndex(0);
    setRevealed(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">單字管理與複習</h1>
        <button
          type="button"
          onClick={clearAll}
          className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
          disabled={entries.length === 0}
        >
          清空單字庫
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">複習卡</h2>
        {!current ? (
          <p className="text-sm text-slate-500">目前沒有單字，先到章節練習加入單字。</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">第 {reviewIndex + 1} / {reviewList.length} 張</p>
            <p className="text-2xl font-bold">{current.term}</p>
            {revealed ? (
              <>
                <p className="text-lg text-amber-700">{current.translation}</p>
                <p className="text-sm text-slate-700">{current.definition}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">先想看看意思，再按「顯示答案」</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="rounded border px-3 py-1 text-sm hover:bg-slate-50"
              >
                {revealed ? '隱藏答案' : '顯示答案'}
              </button>
              <button type="button" onClick={nextCard} className="rounded border px-3 py-1 text-sm hover:bg-slate-50">
                下一張
              </button>
              <button
                type="button"
                onClick={() => deleteEntry(current.id)}
                className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
              >
                移除此字
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">單字清單</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">尚無單字。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded border p-3">
                <p className="font-semibold">{entry.term} → {entry.translation}</p>
                <p className="mt-1 text-slate-600">{entry.definition}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
