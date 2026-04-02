import { PracticeAttempt } from '@/lib/schemas/practice';

const STORAGE_KEY = 'cct_practice_attempts_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadPracticeAttempts(): PracticeAttempt[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PracticeAttempt[]) : [];
  } catch {
    return [];
  }
}

export function savePracticeAttempt(attempt: PracticeAttempt): void {
  const all = loadPracticeAttempts();
  const merged = [attempt, ...all.filter((x) => x.id !== attempt.id)].slice(0, 200);
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function replacePracticeAttempts(attempts: PracticeAttempt[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts.slice(0, 200)));
}

export function deletePracticeAttempt(attemptId: string): PracticeAttempt[] {
  const all = loadPracticeAttempts();
  const next = all.filter((x) => x.id !== attemptId);
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
