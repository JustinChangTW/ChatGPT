export type ChapterProgressEntry = {
  chapter: string;
  attempts: number;
  completed: number;
  totalQuestions: number;
  lastScore: number;
  updatedAt: string;
};

const STORAGE_KEY = 'cct_chapter_progress_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadChapterProgress(): ChapterProgressEntry[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChapterProgressEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveChapterProgress(entries: ChapterProgressEntry[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function updateChapterProgress(input: { chapter: string; totalQuestions: number; score: number; completed: boolean }): ChapterProgressEntry {
  const entries = loadChapterProgress();
  const existing = entries.find((x) => x.chapter === input.chapter);
  const next: ChapterProgressEntry = {
    chapter: input.chapter,
    attempts: (existing?.attempts ?? 0) + 1,
    completed: (existing?.completed ?? 0) + (input.completed ? 1 : 0),
    totalQuestions: input.totalQuestions,
    lastScore: input.score,
    updatedAt: new Date().toISOString()
  };
  const merged = [...entries.filter((x) => x.chapter !== input.chapter), next].sort((a, b) => a.chapter.localeCompare(b.chapter));
  saveChapterProgress(merged);
  return next;
}
