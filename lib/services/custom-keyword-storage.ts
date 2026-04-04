import { DictionaryEntry } from '@/lib/services/inline-dictionary';

const STORAGE_KEY = 'cct_custom_keywords_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export type CustomKeywordsByQuestion = Record<string, DictionaryEntry[]>;

export function loadCustomKeywords(): CustomKeywordsByQuestion {
  if (!isBrowser()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? (parsed as CustomKeywordsByQuestion) : {};
  } catch {
    return {};
  }
}

export function saveCustomKeywords(data: CustomKeywordsByQuestion): CustomKeywordsByQuestion {
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  return data;
}

