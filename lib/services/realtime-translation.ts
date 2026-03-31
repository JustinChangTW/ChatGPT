import { DictionaryEntry } from '@/lib/services/inline-dictionary';
import { DictionaryProviderConfig, loadDictionaryProviders } from '@/lib/services/dictionary-provider-config';
import { loadAIParamsConfig } from '@/lib/services/ai-params-config';

const cache = new Map<string, DictionaryEntry>();

function buildProviderUrl(provider: DictionaryProviderConfig, term: string): string {
  return provider.endpoint.replace('{word}', encodeURIComponent(term));
}

function parseDictionaryData(provider: DictionaryProviderConfig, payload: unknown): Partial<DictionaryEntry> {
  if (provider.kind === 'dictionaryapi_dev') {
    const list = payload as Array<{
      phonetic?: string;
      phonetics?: Array<{ text?: string; audio?: string }>;
      meanings?: Array<{ definitions?: Array<{ definition?: string }> }>;
    }>;
    const first = list?.[0];
    return {
      phonetic: first?.phonetic || first?.phonetics?.find((x) => x.text)?.text,
      audioUrl: first?.phonetics?.find((x) => x.audio)?.audio,
      definition: first?.meanings?.[0]?.definitions?.[0]?.definition?.trim()
    };
  }

  const free = payload as {
    entries?: Array<{
      pronunciations?: Array<{ text?: string }>;
      senses?: Array<{ definition?: string }>;
    }>;
  };
  const first = free.entries?.[0];
  return {
    phonetic: first?.pronunciations?.find((x) => x.text)?.text,
    definition: first?.senses?.[0]?.definition?.trim()
  };
}

export async function fetchRealtimeTranslation(term: string): Promise<DictionaryEntry | null> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized) ?? null;

  try {
    const aiParams = loadAIParamsConfig();
    const translated = aiParams.enabled
      ? await (async () => {
          const translationUrl = aiParams.translationEndpoint
            .replace('{text}', encodeURIComponent(normalized))
            .replace('{source}', encodeURIComponent(aiParams.sourceLang))
            .replace('{target}', encodeURIComponent(aiParams.targetLang));
          const translateRes = await fetch(translationUrl);
          const translateData = translateRes.ok
            ? ((await translateRes.json()) as { responseData?: { translatedText?: string } })
            : null;
          return translateData?.responseData?.translatedText?.trim() ?? '';
        })()
      : '';

    const providers = loadDictionaryProviders().filter((x) => x.enabled);
    let phonetic: string | undefined;
    let audioUrl: string | undefined;
    let englishDefinition: string | undefined;
    let definitionSource = '';
    for (const provider of providers) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(buildProviderUrl(provider, normalized));
        if (!res.ok) continue;
        // eslint-disable-next-line no-await-in-loop
        const payload = await res.json();
        const parsed = parseDictionaryData(provider, payload);
        phonetic = parsed.phonetic || phonetic;
        audioUrl = parsed.audioUrl || audioUrl;
        if (parsed.definition) {
          englishDefinition = parsed.definition;
          definitionSource = provider.name;
          break;
        }
      } catch {
        // ignore provider error and continue fallback chain
      }
    }

    if (!translated && !englishDefinition) return null;
    const entry: DictionaryEntry = {
      term: normalized,
      translation: aiParams.enabled ? translated || '（查無中文翻譯）' : '（AI 翻譯已停用）',
      definition: englishDefinition
        ? `${englishDefinition}（來源：${definitionSource || 'Dictionary API'}）`
        : aiParams.enabled
          ? `即時翻譯（來源：${aiParams.model}）`
          : '即時翻譯已停用（可在 Admin 啟用）',
      phonetic,
      audioUrl
    };
    cache.set(normalized, entry);
    return entry;
  } catch {
    return null;
  }
}
