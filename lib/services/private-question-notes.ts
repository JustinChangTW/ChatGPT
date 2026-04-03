const STORAGE_KEY_PREFIX = 'cct_private_question_notes_v1';

function keyForUser(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId || 'local-user'}`;
}

export function loadPrivateQuestionNotes(userId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function loadPrivateQuestionNote(userId: string, questionId: string): string {
  const all = loadPrivateQuestionNotes(userId);
  return all[questionId] ?? '';
}

export function savePrivateQuestionNote(userId: string, questionId: string, content: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const all = loadPrivateQuestionNotes(userId);
  const next = { ...all, [questionId]: content };
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  return next;
}
