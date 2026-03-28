import { DictionaryEntry } from '@/lib/services/inline-dictionary';

const cache = new Map<string, DictionaryEntry>();

export async function fetchRealtimeTranslation(term: string): Promise<DictionaryEntry | null> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized) ?? null;

  try {
    const [translateRes, dictionaryRes] = await Promise.all([
      fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=en|zh-TW`),
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`)
    ]);

    const translateData = translateRes.ok
      ? ((await translateRes.json()) as { responseData?: { translatedText?: string } })
      : null;
    const translated = translateData?.responseData?.translatedText?.trim() ?? '';

    const dictData = dictionaryRes.ok
      ? ((await dictionaryRes.json()) as Array<{
          phonetic?: string;
          phonetics?: Array<{ text?: string; audio?: string }>;
          meanings?: Array<{ definitions?: Array<{ definition?: string }> }>;
        }>)
      : [];
    const first = dictData[0];
    const phonetic = first?.phonetic || first?.phonetics?.find((x) => x.text)?.text;
    const audioUrl = first?.phonetics?.find((x) => x.audio)?.audio;
    const englishDefinition = first?.meanings?.[0]?.definitions?.[0]?.definition?.trim();

    if (!translated && !englishDefinition) return null;
    const entry: DictionaryEntry = {
      term: normalized,
      translation: translated || '（查無中文翻譯）',
      definition: englishDefinition
        ? `${englishDefinition}（來源：Free Dictionary API）`
        : `即時翻譯（來源：MyMemory）`,
      phonetic,
      audioUrl
    };
    cache.set(normalized, entry);
    return entry;
  } catch {
    return null;
  }
}
