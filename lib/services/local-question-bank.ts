import { Question, questionImportSchema } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';

const STORAGE_KEY = 'cct_question_bank_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadQuestionBank(): Question[] {
  if (!isBrowser()) return sampleQuestions;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return sampleQuestions;

  try {
    const parsed = JSON.parse(raw);
    return questionImportSchema.parse(parsed);
  } catch {
    return sampleQuestions;
  }
}

export function saveQuestionBank(questions: Question[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}

export function appendQuestionBank(imported: Question[]): Question[] {
  const existing = loadQuestionBank();
  const mergedMap = new Map<string, Question>();
  [...existing, ...imported].forEach((q) => mergedMap.set(q.id, q));
  const merged = Array.from(mergedMap.values());
  saveQuestionBank(merged);
  return merged;
}

export function replaceQuestionBank(imported: Question[]): Question[] {
  saveQuestionBank(imported);
  return imported;
}

export function resetQuestionBank(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
