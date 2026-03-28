import { DictionaryEntry } from '@/lib/services/inline-dictionary';

const STORAGE_KEY = 'cct_vocabulary_bank_v1';

export type VocabularyEntry = DictionaryEntry & {
  id: string;
  sourceQuestionId?: string;
  createdAt: string;
  proficiencyLevel: 'new' | 'learning' | 'familiar' | 'mastered';
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
    if (!Array.isArray(parsed)) return [];
    return (parsed as Array<Partial<VocabularyEntry>>).map((entry) => ({
      id: entry.id ?? `vocab-${Date.now()}-${(entry.term ?? '').toLowerCase()}`,
      term: entry.term ?? '',
      translation: entry.translation ?? '（尚未填寫）',
      definition: entry.definition ?? '（尚未填寫）',
      sourceQuestionId: entry.sourceQuestionId,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      proficiencyLevel: entry.proficiencyLevel ?? 'new',
      phonetic: entry.phonetic,
      audioUrl: entry.audioUrl
    }));
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
    createdAt: new Date().toISOString(),
    proficiencyLevel: 'new'
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

export function updateVocabularyEntry(
  id: string,
  patch: Partial<Pick<VocabularyEntry, 'term' | 'translation' | 'definition'>>
): VocabularyEntry[] {
  const all = loadVocabularyBank();
  const updated = all.map((entry) => {
    if (entry.id !== id) return entry;
    return {
      ...entry,
      term: (patch.term ?? entry.term).trim(),
      translation: (patch.translation ?? entry.translation).trim(),
      definition: (patch.definition ?? entry.definition).trim()
    };
  });
  return persistVocabularyBank(updated);
}

export function setVocabularyProficiency(
  id: string,
  level: VocabularyEntry['proficiencyLevel']
): VocabularyEntry[] {
  const all = loadVocabularyBank();
  const updated = all.map((entry) => (entry.id === id ? { ...entry, proficiencyLevel: level } : entry));
  return persistVocabularyBank(updated);
}
