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

function persistVocabularyBank(entries: VocabularyEntry[]): VocabularyEntry[] {
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
  return entries;
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
  return persistVocabularyBank(merged);
}

export function removeVocabularyEntry(id: string): VocabularyEntry[] {
  const all = loadVocabularyBank();
  const filtered = all.filter((x) => x.id !== id);
  return persistVocabularyBank(filtered);
}

export function clearVocabularyBank(): VocabularyEntry[] {
  return persistVocabularyBank([]);
}

export function findVocabularyEntry(term: string): VocabularyEntry | null {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  const all = loadVocabularyBank();
  return all.find((entry) => entry.term.toLowerCase() === normalized) ?? null;
}
