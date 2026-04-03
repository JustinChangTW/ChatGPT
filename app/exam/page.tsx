'use client';

import { useEffect, useMemo, useState } from 'react';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { assembleOfficialExam } from '@/lib/services/exam-assembly';
import { buildPracticeAttempt } from '@/lib/services/practice-attempt-service';
import { deletePracticeAttempt, loadPracticeAttempts, savePracticeAttempt } from '@/lib/services/practice-attempt-storage';
import { rebuildWrongNotebookFromAttempts } from '@/lib/services/wrong-notebook-storage';
import { clearExamSessionDraft, loadExamSessionDraft, saveExamSessionDraft } from '@/lib/services/exam-session-storage';
import { auth } from '@/lib/firebase/client';

type ExamSession = {
  id: string;
  questions: Question[];
  answers: Record<string, string>;
  currentIndex: number;
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
  const currentUserId = auth?.currentUser?.uid ?? 'local-user';

  useEffect(() => {
    setBank(loadQuestionBank());
    setHistory(loadPracticeAttempts().filter((a) => a.mode === 'exam'));
    const draft = loadExamSessionDraft();
    if (draft && !draft.submitted) {
      setSession(draft);
    }
  }, []);

  useEffect(() => {
    if (!session || session.submitted) {
      clearExamSessionDraft();
      return;
    }
    saveExamSessionDraft(session);
    const draftQuestionResults = session.questions.map((q) => {
      const userAnswer = session.answers[q.id] ?? '';
      return {
        questionId: q.id,
        sourceType: q.sourceType,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: userAnswer !== '' && userAnswer === q.correctAnswer,
        chapter: q.chapter,
        domain: q.domain,
        questionType: q.questionType
      };
    });
    const draftAttempt = buildPracticeAttempt({
      id: session.id,
      userId: currentUserId,
      mode: 'exam',
      questionResults: draftQuestionResults,
      startedAt: session.createdAt,
      submittedAt: new Date().toISOString()
    });
    savePracticeAttempt(draftAttempt);
    setHistory(loadPracticeAttempts().filter((a) => a.mode === 'exam'));
  }, [session, currentUserId]);

  const answeredCount = useMemo(() => {
    if (!session) return 0;
    return Object.keys(session.answers).length;
  }, [session]);

  const current = useMemo(() => {
    if (!session) return null;
    return session.questions[session.currentIndex] ?? session.questions[0] ?? null;
  }, [session]);

  const goToQuestion = (index: number) => {
    setSession((s) => {
      if (!s) return s;
      const next = Math.min(Math.max(index, 0), s.questions.length - 1);
      return { ...s, currentIndex: next };
    });
  };

  const prevQuestion = () => {
    setSession((s) => (s ? { ...s, currentIndex: Math.max(s.currentIndex - 1, 0) } : s));
  };

  const nextQuestion = () => {
    setSession((s) => (s ? { ...s, currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) } : s));
  };

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
        isCorrect: userAnswer !== '' && userAnswer === q.correctAnswer,
        chapter: q.chapter,
        domain: q.domain,
        questionType: q.questionType
      };
    });
    const attempt = buildPracticeAttempt({
      id: session.id,
      userId: currentUserId,
      mode: 'exam',
      questionResults,
      startedAt: session.createdAt,
      submittedAt
    });
    savePracticeAttempt(attempt);
    rebuildWrongNotebookFromAttempts(loadPracticeAttempts(), currentUserId);
    setSession((s) => (s ? { ...s, submitted: true } : s));
    clearExamSessionDraft();
    setHistory(loadPracticeAttempts().filter((a) => a.mode === 'exam'));
  };

  const generateNewPaper = async () => {
    const assembled = await assembleOfficialExam(bank);
    setSession({
      id: `exam-${Date.now()}`,
      questions: shuffled(assembled),
      answers: {},
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      submitted: false
    });
  };

  const deletePaperRecord = (attemptId: string) => {
    const remaining = deletePracticeAttempt(attemptId);
    rebuildWrongNotebookFromAttempts(remaining, currentUserId);
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">試券編號：{session.id} · 第 {session.currentIndex + 1}/{session.questions.length} 題 · 已作答 {answeredCount}/{session.questions.length}</p>
          {current ? (
            <div className="mt-2">
              <p className="font-semibold whitespace-pre-line leading-8">{current.stem}</p>
              <div className="mt-2 space-y-1">
                {current.options.map((o) => (
                  <label
                    key={o.key}
                    className={`block rounded-lg border p-2 transition ${
                      session.answers[current.id] === o.key ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
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
                    {o.key}. <span className="whitespace-pre-line leading-7">{o.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
            <button className="rounded border px-3 py-2" onClick={prevQuestion} disabled={session.submitted || session.currentIndex === 0}>
              上一題
            </button>
            <button
              className="rounded border px-3 py-2"
              onClick={nextQuestion}
              disabled={session.submitted || session.currentIndex >= session.questions.length - 1}
            >
              下一題
            </button>
            <button className="rounded border px-3 py-2 sm:w-auto" onClick={submitExam} disabled={session.submitted}>
              {session.submitted ? '已交卷' : '交卷'}
            </button>
          </div>
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-sm text-slate-600">題號導覽（已作答會變色）</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-10 lg:grid-cols-12">
              {session.questions.map((q, idx) => {
                const answered = session.answers[q.id] !== undefined;
                const active = session.currentIndex === idx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    className={`h-8 rounded border text-xs ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : answered
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    disabled={session.submitted}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
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
