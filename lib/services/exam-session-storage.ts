import { Question } from '@/lib/schemas/question';

const STORAGE_KEY = 'cct_exam_session_draft_v1';

type ExamSessionDraft = {
  id: string;
  questions: Question[];
  answers: Record<string, string>;
  currentIndex: number;
  createdAt: string;
  submitted: boolean;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadExamSessionDraft(): ExamSessionDraft | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ExamSessionDraft;
    if (!parsed?.id || !Array.isArray(parsed?.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveExamSessionDraft(draft: ExamSessionDraft): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearExamSessionDraft(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
