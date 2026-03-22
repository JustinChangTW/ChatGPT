'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePracticeStore } from '@/lib/store/use-practice-store';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { assembleChapterPractice } from '@/lib/services/exam-assembly';

const fallbackChapters = ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Chapter 6', 'Chapter 7', 'Chapter 8'];

export default function ChapterPracticePage() {
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const chapters = useMemo(() => {
    const set = new Set(bank.map((q) => q.chapter));
    return set.size > 0 ? Array.from(set) : fallbackChapters;
  }, [bank]);

  const [selectedChapter, setSelectedChapter] = useState(fallbackChapters[0]);
  const { questions, currentIndex, answers, setSession, setAnswer, next, prev } = usePracticeStore();

  useEffect(() => {
    const loaded = loadQuestionBank();
    setBank(loaded);
    if (loaded[0]?.chapter) setSelectedChapter(loaded[0].chapter);
  }, []);

  const current = questions[currentIndex];

  const startPractice = async () => {
    const qs = await assembleChapterPractice(bank, selectedChapter);
    setSession({ sessionId: `chapter-${Date.now()}`, questions: qs });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chapter Practice</h1>
      <p className="text-sm text-slate-500">目前本機題庫：{bank.length} 題（含 Admin 匯入）</p>
      <div className="flex gap-2">
        <select className="rounded border px-3 py-2" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)}>
          {chapters.map((ch) => <option key={ch}>{ch}</option>)}
        </select>
        <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={startPractice}>開始 10 題練習</button>
      </div>
      {current ? (
        <div className="rounded border bg-white p-4">
          <p className="mb-2 text-sm text-slate-500">第 {currentIndex + 1}/{questions.length} 題 · {current.sourceType === 'generated' ? '系統生成題' : '原始題庫'}</p>
          <h2 className="mb-3 font-semibold">{current.stem}</h2>
          <div className="space-y-2">
            {current.options.map((opt) => (
              <label className="block rounded border p-2" key={opt.key}>
                <input type="radio" className="mr-2" name={current.id} checked={answers[current.id] === opt.key} onChange={() => setAnswer(current.id, opt.key)} />
                {opt.key}. {opt.text}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded border px-3 py-1" onClick={prev}>上一題</button>
            <button className="rounded border px-3 py-1" onClick={next}>下一題</button>
          </div>
        </div>
      ) : <p>請先選章節開始測驗。</p>}
    </div>
  );
}
