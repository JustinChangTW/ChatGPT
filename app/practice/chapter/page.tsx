'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePracticeStore } from '@/lib/store/use-practice-store';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { assembleChapterPractice } from '@/lib/services/exam-assembly';
import { loadChapterProgress, updateChapterProgress } from '@/lib/services/chapter-progress-storage';
import { recordWrongNotebook } from '@/lib/services/wrong-notebook-storage';
import { buildPracticeAttempt } from '@/lib/services/practice-attempt-service';
import { savePracticeAttempt } from '@/lib/services/practice-attempt-storage';

const fallbackChapters = ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Chapter 6', 'Chapter 7', 'Chapter 8'];

export default function ChapterPracticePage() {
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const [progress, setProgress] = useState(loadChapterProgress());
  const [submitted, setSubmitted] = useState(false);
  const chapters = useMemo(() => {
    const set = new Set(bank.map((q) => q.chapter));
    return set.size > 0 ? Array.from(set) : fallbackChapters;
  }, [bank]);

  const [selectedChapter, setSelectedChapter] = useState(fallbackChapters[0]);
  // Keep a single destructure to avoid accidental duplicate declarations during merge edits.
  const { questions, currentIndex, answers, setSession, setAnswer, next, prev, reset } = usePracticeStore();

  useEffect(() => {
    const loaded = loadQuestionBank();
    setBank(loaded);
    if (loaded[0]?.chapter) setSelectedChapter(loaded[0].chapter);
    setProgress(loadChapterProgress());
  }, []);

  const current = questions[currentIndex];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length,
    [questions, answers]
  );

  const result = useMemo(() => {
    if (questions.length === 0) return null;
    const detail = questions.map((q) => {
      const userAnswer = answers[q.id];
      const correct = Array.isArray(q.correctAnswer)
        ? Array.isArray(userAnswer) &&
          q.correctAnswer.length === userAnswer.length &&
          q.correctAnswer.every((x) => userAnswer.includes(x))
        : userAnswer === q.correctAnswer;
      return { question: q, userAnswer, correct };
    });
    const correctCount = detail.filter((x) => x.correct).length;
    const score = Math.round((correctCount / questions.length) * 100);
    return { detail, correctCount, score };
  }, [questions, answers]);

  const startPractice = async () => {
    const qs = await assembleChapterPractice(bank, selectedChapter);
    setSession({ sessionId: `chapter-${Date.now()}`, questions: qs });
    setSubmitted(false);
  };

  const submitPractice = () => {
    if (!result) return;
    const nowISO = new Date().toISOString();
    const questionResults = result.detail
      .filter((item) => item.userAnswer !== undefined)
      .map((item) => ({
        questionId: item.question.id,
        sourceType: item.question.sourceType,
        userAnswer: item.userAnswer as string | string[],
        correctAnswer: item.question.correctAnswer,
        isCorrect: item.correct,
        chapter: item.question.chapter,
        domain: item.question.domain,
        questionType: item.question.questionType
      }));
    result.detail.forEach((item) => {
      if (item.userAnswer === undefined) return;
      recordWrongNotebook({
        userId: 'local-user',
        questionId: item.question.id,
        isCorrect: item.correct,
        selectedAnswer: Array.isArray(item.userAnswer) ? item.userAnswer : String(item.userAnswer),
        nowISO
      });
    });
    if (questionResults.length > 0) {
      const attempt = buildPracticeAttempt({
        id: `attempt-${Date.now()}`,
        userId: 'local-user',
        mode: 'chapter',
        selectedChapter,
        questionResults,
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        submittedAt: nowISO
      });
      savePracticeAttempt(attempt);
    }
    setSubmitted(true);
    updateChapterProgress({
      chapter: selectedChapter,
      totalQuestions: questions.length,
      score: result.score,
      completed: answeredCount >= questions.length
    });
    setProgress(loadChapterProgress());
  };

  const restartPractice = async () => {
    reset();
    setSubmitted(false);
    await startPractice();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chapter Practice</h1>
      <p className="text-sm text-slate-500">目前本機題庫：{bank.length} 題（含 Admin 匯入）</p>
      <div className="grid gap-2 sm:flex">
        <select className="w-full rounded border px-3 py-3 sm:w-auto" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)}>
          {chapters.map((ch) => <option key={ch}>{ch}</option>)}
        </select>
        <button className="rounded bg-blue-600 px-4 py-3 text-white" onClick={startPractice}>開始 10 題練習</button>
      </div>
      <div className="rounded border bg-white p-4">
        <p className="mb-2 text-sm font-semibold">章節進度追蹤</p>
        <ul className="space-y-1 text-sm">
          {chapters.map((ch) => {
            const p = progress.find((x) => x.chapter === ch);
            const doneRate = p ? Math.round((p.completed / Math.max(p.attempts, 1)) * 100) : 0;
            return (
              <li key={ch} className="flex flex-col gap-1 border-b pb-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <span>{ch}</span>
                <span className="text-slate-600">
                  {p ? `完成 ${p.completed}/${p.attempts} 次 · 最近 ${p.lastScore} 分 · 完成率 ${doneRate}%` : '尚未作答'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {current && !submitted ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm text-slate-500">第 {currentIndex + 1}/{questions.length} 題 · {current.sourceType === 'generated' ? '系統生成題' : '原始題庫'}</p>
          <h2 className="mb-4 whitespace-pre-line text-lg font-semibold leading-8">{current.stem}</h2>
          <div className="space-y-2">
            {current.options.map((opt) => (
              <label className="block rounded-lg border p-3 transition hover:border-blue-400 hover:bg-blue-50" key={opt.key}>
                <input type="radio" className="mr-2" name={current.id} checked={answers[current.id] === opt.key} onChange={() => setAnswer(current.id, opt.key)} />
                <span className="font-medium">{opt.key}.</span>{' '}
                <span className="whitespace-pre-line leading-7">{opt.text}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <button className="rounded border px-3 py-2" onClick={prev}>上一題</button>
            <button className="rounded border px-3 py-2" onClick={next}>下一題</button>
            <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={submitPractice}>交卷看結果</button>
            <p className="self-center text-sm text-slate-500 sm:ml-1">已作答 {answeredCount}/{questions.length}</p>
          </div>
        </div>
      ) : null}

      {submitted && result ? (
        <div className="space-y-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-lg font-semibold">測驗結果：{result.score} 分</p>
            <p className="text-sm text-slate-600">答對 {result.correctCount} / {questions.length} 題（{answeredCount >= questions.length ? '已完成 10 題' : '未全部作答即交卷'}）</p>
            <button className="mt-3 rounded border px-3 py-1" onClick={restartPractice}>再做一次 10 題</button>
          </div>
          {result.detail.map((item, idx) => (
            <div key={item.question.id} className="rounded-lg border bg-white p-4">
              <p className="font-semibold whitespace-pre-line leading-8">第 {idx + 1} 題：{item.question.stem}</p>
              <p className={`mt-1 text-sm ${item.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                {item.correct ? '✅ 答對' : '❌ 答錯'}｜你的答案：{Array.isArray(item.userAnswer) ? item.userAnswer.join(',') : item.userAnswer ?? '未作答'}
              </p>
              <p className="text-sm text-slate-600">正確答案：{Array.isArray(item.question.correctAnswer) ? item.question.correctAnswer.join(',') : item.question.correctAnswer}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">詳解：{item.question.explanation}</p>
            </div>
          ))}
        </div>
      ) : null}
      {!current && <p>請先選章節開始測驗。</p>}
    </div>
  );
}
