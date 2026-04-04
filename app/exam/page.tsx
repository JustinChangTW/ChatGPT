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
  marked: Record<string, boolean>;
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
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'unfinished'>('all');
  const currentUserId = auth?.currentUser?.uid ?? 'local-user';
  const questionPool = useMemo(() => new Map([...sampleQuestions, ...bank].map((q) => [q.id, q])), [bank]);

  useEffect(() => {
    setBank(loadQuestionBank());
    setHistory(loadPracticeAttempts().filter((a) => a.mode === 'exam'));
    const draft = loadExamSessionDraft();
    if (draft && !draft.submitted) {
      setSession({ ...draft, marked: (draft as ExamSession).marked ?? {} });
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
  const unansweredIndexes = useMemo(() => {
    if (!session) return [];
    return session.questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => session.answers[q.id] === undefined || session.answers[q.id] === '')
      .map(({ idx }) => idx + 1);
  }, [session]);

  const current = useMemo(() => {
    if (!session) return null;
    return session.questions[session.currentIndex] ?? session.questions[0] ?? null;
  }, [session]);
  const latestUnfinished = useMemo(
    () =>
      history
        .filter((h) => h.questionResults.some((r) => !(typeof r.userAnswer === 'string' && r.userAnswer !== '')))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null,
    [history]
  );
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    return history.filter((h) => {
      const completed = h.questionResults.every((r) => typeof r.userAnswer === 'string' && r.userAnswer !== '');
      return historyFilter === 'completed' ? completed : !completed;
    });
  }, [history, historyFilter]);

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
    if (unansweredIndexes.length > 0) {
      const preview = unansweredIndexes.slice(0, 12).join(', ');
      const keepSubmit = window.confirm(`尚有 ${unansweredIndexes.length} 題未作答（題號：${preview}${unansweredIndexes.length > 12 ? '…' : ''}）。\n按「確定」仍交卷，按「取消」返回作答。`);
      if (!keepSubmit) {
        goToQuestion(Math.max(unansweredIndexes[0] - 1, 0));
        return;
      }
    }
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
      marked: {},
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      submitted: false
    });
  };

  const restorePaperRecord = (attemptId: string) => {
    const target = history.find((x) => x.id === attemptId);
    if (!target) return;
    const questions = target.questionResults
      .map((r) => questionPool.get(r.questionId))
      .filter((q): q is Question => !!q);
    if (questions.length === 0) return;
    const answers: Record<string, string> = {};
    target.questionResults.forEach((r) => {
      if (typeof r.userAnswer === 'string' && r.userAnswer) answers[r.questionId] = r.userAnswer;
    });
    const firstUnansweredIndex = questions.findIndex((q) => !answers[q.id]);
    const completed = questions.every((q) => !!answers[q.id]);
    setSession({
      id: target.id,
      questions,
      answers,
      marked: {},
      currentIndex: firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0,
      createdAt: target.startedAt,
      submitted: completed
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
      <div className="flex flex-wrap gap-2">
        <button className="w-full rounded bg-blue-600 px-4 py-3 text-white sm:w-auto" onClick={generateNewPaper}>產生新試券（60題）</button>
        {latestUnfinished && (
          <button className="w-full rounded border px-4 py-3 sm:w-auto" onClick={() => restorePaperRecord(latestUnfinished.id)}>
            繼續上次未完成
          </button>
        )}
      </div>
      {session && (
        <div className="rounded border bg-white p-3">
          <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
            <span>作答進度 {answeredCount}/{session.questions.length}</span>
            <span>剩餘 {session.questions.length - answeredCount} 題</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-blue-600 transition-all"
              style={{ width: `${session.questions.length > 0 ? Math.round((answeredCount / session.questions.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {session ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">試券編號：{session.id} · 第 {session.currentIndex + 1}/{session.questions.length} 題 · 已作答 {answeredCount}/{session.questions.length} · 未作答 {unansweredIndexes.length}</p>
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
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                setSession((s) =>
                  s && current
                    ? { ...s, marked: { ...s.marked, [current.id]: !s.marked[current.id] } }
                    : s
                )
              }
              disabled={session.submitted || !current}
            >
              {current && session.marked[current.id] ? '取消標記' : '標記待複查'}
            </button>
          </div>
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-sm text-slate-600">題號導覽（已作答會變色）</p>
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-10 lg:grid-cols-12">
              {session.questions.map((q, idx) => {
                const answered = session.answers[q.id] !== undefined;
                const active = session.currentIndex === idx;
                const marked = !!session.marked[q.id];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    className={`h-8 rounded border text-xs ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : marked
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">模擬考歷史紀錄</p>
          <select className="rounded border px-2 py-1 text-sm" value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value as 'all' | 'completed' | 'unfinished')}>
            <option value="all">全部</option>
            <option value="unfinished">未完成</option>
            <option value="completed">已完成</option>
          </select>
        </div>
        {filteredHistory.length === 0 ? <p className="text-sm text-slate-500">尚無紀錄</p> : null}
        <ul className="space-y-2">
          {filteredHistory.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 rounded border p-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm break-all">
                {new Date(h.submittedAt).toLocaleString()} · 分數 {h.score} · {h.correctCount}/{h.totalQuestions}
                {' · '}
                {h.questionResults.every((r) => typeof r.userAnswer === 'string' && r.userAnswer !== '') ? '已完成' : '未完成'}
              </span>
              <div className="flex w-full gap-2 sm:w-auto">
                <button className="w-full rounded border px-2 py-2 sm:w-auto" onClick={() => restorePaperRecord(h.id)}>
                  載入試券
                </button>
                <button className="w-full rounded border border-rose-300 px-2 py-2 text-rose-700 sm:w-auto" onClick={() => deletePaperRecord(h.id)}>
                  刪除並重算錯題本
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
