import { DictionaryEntry } from '@/lib/services/inline-dictionary';

const STORAGE_KEY = 'cct_vocabulary_bank_v1';

export type VocabularyEntry = DictionaryEntry & {
  id: string;
  sourceQuestionId?: string;
  createdAt: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadVocabularyBank(): VocabularyEntry[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VocabularyEntry[]) : [];
  } catch {
    return [];
  }
}

export function addVocabularyEntry(input: DictionaryEntry & { sourceQuestionId?: string }): VocabularyEntry[] {
  const all = loadVocabularyBank();
  const existing = all.find((x) => x.term.toLowerCase() === input.term.toLowerCase());
  const next: VocabularyEntry = existing ?? {
    ...input,
    id: `vocab-${Date.now()}-${input.term.toLowerCase()}`,
    createdAt: new Date().toISOString()
  };
  const merged = [...all.filter((x) => x.term.toLowerCase() !== input.term.toLowerCase()), next].sort((a, b) => a.term.localeCompare(b.term));
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}
