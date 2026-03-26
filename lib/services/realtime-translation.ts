import { DictionaryEntry } from '@/lib/services/inline-dictionary';

const cache = new Map<string, DictionaryEntry>();

export async function fetchRealtimeTranslation(term: string): Promise<DictionaryEntry | null> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized) ?? null;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=en|zh-TW`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated) return null;
    const entry: DictionaryEntry = {
      term: normalized,
      translation: translated,
      definition: `即時翻譯（來源：MyMemory）`
    };
    cache.set(normalized, entry);
    return entry;
  } catch {
    return null;
  }
}
