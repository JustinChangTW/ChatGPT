'use client';

import { useEffect, useMemo, useState } from 'react';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { assembleOfficialExam } from '@/lib/services/exam-assembly';
import { buildPracticeAttempt } from '@/lib/services/practice-attempt-service';
import { deletePracticeAttempt, loadPracticeAttempts, savePracticeAttempt } from '@/lib/services/practice-attempt-storage';
import { rebuildWrongNotebookFromAttempts } from '@/lib/services/wrong-notebook-storage';

type ExamSession = {
  id: string;
  questions: Question[];
  answers: Record<string, string>;
  createdAt: string;
  submitted: boolean;
};

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function ExamPage() {
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [history, setHistory] = useState(() => loadPracticeAttempts().filter((a) => a.mode === 'exam'));

  useEffect(() => {
    setBank(loadQuestionBank());
    setHistory(loadPracticeAttempts().filter((a) => a.mode === 'exam'));
  }, []);

  const answeredCount = useMemo(() => {
    if (!session) return 0;
    return Object.keys(session.answers).length;
  }, [session]);

  const current = useMemo(() => {
    if (!session) return null;
    return session.questions.find((q) => !session.answers[q.id]) ?? session.questions[0];
  }, [session]);

  const submitExam = () => {
    if (!session || session.submitted) return;
    const submittedAt = new Date().toISOString();
    const questionResults = session.questions.map((q) => {
      const userAnswer = session.answers[q.id] ?? '';
      return {
        questionId: q.id,
        sourceType: q.sourceType,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: userAnswer === q.correctAnswer,
        chapter: q.chapter,
        domain: q.domain,
        questionType: q.questionType
      };
    });
    const attempt = buildPracticeAttempt({
      id: session.id,
      userId: 'local-user',
      mode: 'exam',
      questionResults,
      startedAt: session.createdAt,
      submittedAt
    });
    savePracticeAttempt(attempt);
    rebuildWrongNotebookFromAttempts(loadPracticeAttempts(), 'local-user');
    setSession((s) => (s ? { ...s, submitted: true } : s));
    setHistory(loadPracticeAttempts().filter((a) => a.mode === 'exam'));
  };

  const generateNewPaper = async () => {
    const assembled = await assembleOfficialExam(bank);
    setSession({
      id: `exam-${Date.now()}`,
      questions: shuffled(assembled),
      answers: {},
      createdAt: new Date().toISOString(),
      submitted: false
    });
  };

  const deletePaperRecord = (attemptId: string) => {
    const remaining = deletePracticeAttempt(attemptId);
    rebuildWrongNotebookFromAttempts(remaining, 'local-user');
    setHistory(remaining.filter((a) => a.mode === 'exam'));
    if (session?.id === attemptId) setSession(null);
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">正式模擬考</h1>
      <p>每次可重新產生試券（題目順序會重排）。刪除某次試券紀錄時，會同步重算錯題本。</p>
      <p className="text-sm text-slate-500">目前本機題庫：{bank.length} 題（含 Admin 匯入）</p>
      <button className="w-full rounded bg-blue-600 px-4 py-3 text-white sm:w-auto" onClick={generateNewPaper}>產生新試券（60題）</button>

      {session ? (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">試券編號：{session.id} · 已作答 {answeredCount}/{session.questions.length}</p>
          {current ? (
            <div className="mt-2">
              <p className="font-semibold">{current.stem}</p>
              <div className="mt-2 space-y-1">
                {current.options.map((o) => (
                  <label key={o.key} className="block rounded border p-2">
                    <input
                      type="radio"
                      className="mr-2"
                      disabled={session.submitted}
                      checked={session.answers[current.id] === o.key}
                      onChange={() =>
                        setSession((s) =>
                          s
                            ? { ...s, answers: { ...s.answers, [current.id]: o.key } }
                            : s
                        )
                      }
                    />
                    {o.key}. {o.text}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <button className="mt-3 w-full rounded border px-3 py-2 sm:w-auto" onClick={submitExam} disabled={session.submitted}>
            {session.submitted ? '已交卷' : '交卷'}
          </button>
        </div>
      ) : null}

      <div className="rounded border bg-white p-4">
        <p className="mb-2 font-semibold">模擬考歷史紀錄</p>
        {history.length === 0 ? <p className="text-sm text-slate-500">尚無紀錄</p> : null}
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 rounded border p-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm break-all">
                {new Date(h.submittedAt).toLocaleString()} · 分數 {h.score} · {h.correctCount}/{h.totalQuestions}
              </span>
              <button className="w-full rounded border border-rose-300 px-2 py-2 text-rose-700 sm:w-auto" onClick={() => deletePaperRecord(h.id)}>
                刪除並重算錯題本
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
