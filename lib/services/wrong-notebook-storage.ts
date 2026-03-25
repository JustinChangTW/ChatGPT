import { WrongAnswer } from '@/lib/schemas/practice';
import { updateWrongAnswerEntry } from '@/lib/services/wrong-answer-service';
import { PracticeAttempt } from '@/lib/schemas/practice';

const STORAGE_KEY = 'cct_wrong_notebook_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadWrongNotebook(): WrongAnswer[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WrongAnswer[]) : [];
  } catch {
    return [];
  }
}

export function saveWrongNotebook(rows: WrongAnswer[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function recordWrongNotebook(input: {
  userId: string;
  questionId: string;
  isCorrect: boolean;
  selectedAnswer: string | string[];
  nowISO?: string;
}): WrongAnswer {
  const rows = loadWrongNotebook();
  const existing = rows.find((x) => x.questionId === input.questionId && x.userId === input.userId) ?? null;
  const next = updateWrongAnswerEntry(existing, {
    id: existing?.id ?? `wrong-${Date.now()}-${input.questionId}`,
    userId: input.userId,
    questionId: input.questionId,
    isCorrect: input.isCorrect,
    selectedAnswer: input.selectedAnswer,
    nowISO: input.nowISO ?? new Date().toISOString()
  });
  const merged = [...rows.filter((x) => x.id !== next.id), next].sort((a, b) => b.wrongCount - a.wrongCount);
  saveWrongNotebook(merged);
  return next;
}

export function rebuildWrongNotebookFromAttempts(attempts: PracticeAttempt[], userId: string): WrongAnswer[] {
  const sorted = [...attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const map = new Map<string, WrongAnswer>();
  sorted.forEach((attempt) => {
    attempt.questionResults.forEach((qr) => {
      if (qr.userAnswer === undefined) return;
      const existing = map.get(qr.questionId) ?? null;
      const next = updateWrongAnswerEntry(existing, {
        id: existing?.id ?? `wrong-rebuild-${qr.questionId}`,
        userId,
        questionId: qr.questionId,
        isCorrect: qr.isCorrect,
        selectedAnswer: qr.userAnswer,
        nowISO: attempt.submittedAt
      });
      map.set(qr.questionId, next);
    });
  });
  const rows = Array.from(map.values()).sort((a, b) => b.wrongCount - a.wrongCount);
  saveWrongNotebook(rows);
  return rows;
}
