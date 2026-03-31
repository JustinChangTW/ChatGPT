export type AIParamsConfig = {
  enabled: boolean;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  sourceLang: string;
  targetLang: string;
  translationEndpoint: string;
};

const STORAGE_KEY = 'cct_ai_params_v1';

const DEFAULT_CONFIG: AIParamsConfig = {
  enabled: true,
  model: 'gpt-4o-mini',
  temperature: 0.2,
  topP: 1,
  maxTokens: 400,
  sourceLang: 'en',
  targetLang: 'zh-TW',
  translationEndpoint: 'https://api.mymemory.translated.net/get?q={text}&langpair={source}|{target}'
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function loadAIParamsConfig(): AIParamsConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIParamsConfig>;
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      model: parsed.model?.trim() || DEFAULT_CONFIG.model,
      temperature: clamp(Number(parsed.temperature ?? DEFAULT_CONFIG.temperature), 0, 2),
      topP: clamp(Number(parsed.topP ?? DEFAULT_CONFIG.topP), 0, 1),
      maxTokens: clamp(Number(parsed.maxTokens ?? DEFAULT_CONFIG.maxTokens), 1, 4000),
      sourceLang: parsed.sourceLang?.trim() || DEFAULT_CONFIG.sourceLang,
      targetLang: parsed.targetLang?.trim() || DEFAULT_CONFIG.targetLang,
      translationEndpoint: parsed.translationEndpoint?.trim() || DEFAULT_CONFIG.translationEndpoint
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAIParamsConfig(config: AIParamsConfig): AIParamsConfig {
  const normalized: AIParamsConfig = {
    enabled: !!config.enabled,
    model: config.model.trim() || DEFAULT_CONFIG.model,
    temperature: clamp(Number(config.temperature), 0, 2),
    topP: clamp(Number(config.topP), 0, 1),
    maxTokens: clamp(Number(config.maxTokens), 1, 4000),
    sourceLang: config.sourceLang.trim() || DEFAULT_CONFIG.sourceLang,
    targetLang: config.targetLang.trim() || DEFAULT_CONFIG.targetLang,
    translationEndpoint: config.translationEndpoint.trim() || DEFAULT_CONFIG.translationEndpoint
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}
