export type AIParamsConfig = {
  enabled: boolean;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  sourceLang: string;
  targetLang: string;
  translationEndpoint: string;
  tutorEnabled: boolean;
  tutorProvider: 'openai' | 'anthropic' | 'google_gemini' | 'azure_openai' | 'openrouter' | 'custom_openai_compatible';
  tutorEndpoint: string;
  tutorApiKey: string;
  tutorApiVersion: string;
  tutorDeploymentId: string;
  tutorModel: string;
  tutorSystemPrompt: string;
  tutorTemperature: number;
  tutorMaxTokens: number;
};

const STORAGE_KEY = 'cct_ai_params_v2';

const DEFAULT_CONFIG: AIParamsConfig = {
  enabled: true,
  model: 'gpt-4o-mini',
  temperature: 0.2,
  topP: 1,
  maxTokens: 400,
  sourceLang: 'en',
  targetLang: 'zh-TW',
  translationEndpoint: 'https://api.mymemory.translated.net/get?q={text}&langpair={source}|{target}',
  tutorEnabled: false,
  tutorProvider: 'openai',
  tutorEndpoint: 'https://api.openai.com/v1/chat/completions',
  tutorApiKey: '',
  tutorApiVersion: '',
  tutorDeploymentId: '',
  tutorModel: 'gpt-4o-mini',
  tutorSystemPrompt:
    '你是一位 C|CT 考試助教。請先指出觀念盲點，再給可執行的修正步驟，最後補一個檢核問題。請用繁體中文且精簡。',
  tutorTemperature: 0.3,
  tutorMaxTokens: 500
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isSafeTranslationEndpoint(endpoint: string): boolean {
  if (!endpoint.includes('{text}') || !endpoint.includes('{source}') || !endpoint.includes('{target}')) return false;
  try {
    const normalized = endpoint
      .replace('{text}', 'hello')
      .replace('{source}', 'en')
      .replace('{target}', 'zh-TW');
    const url = new URL(normalized);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeTutorEndpoint(endpoint: string): boolean {
  if (!endpoint.trim()) return false;
  try {
    const url = new URL(endpoint.trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
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
      translationEndpoint: isSafeTranslationEndpoint(parsed.translationEndpoint?.trim() || '')
        ? (parsed.translationEndpoint as string).trim()
        : DEFAULT_CONFIG.translationEndpoint,
      tutorEnabled: parsed.tutorEnabled ?? DEFAULT_CONFIG.tutorEnabled,
      tutorProvider: parsed.tutorProvider ?? DEFAULT_CONFIG.tutorProvider,
      tutorEndpoint: isSafeTutorEndpoint(parsed.tutorEndpoint?.trim() || '') ? parsed.tutorEndpoint!.trim() : DEFAULT_CONFIG.tutorEndpoint,
      tutorApiKey: parsed.tutorApiKey?.trim() || DEFAULT_CONFIG.tutorApiKey,
      tutorApiVersion: parsed.tutorApiVersion?.trim() || DEFAULT_CONFIG.tutorApiVersion,
      tutorDeploymentId: parsed.tutorDeploymentId?.trim() || DEFAULT_CONFIG.tutorDeploymentId,
      tutorModel: parsed.tutorModel?.trim() || DEFAULT_CONFIG.tutorModel,
      tutorSystemPrompt: parsed.tutorSystemPrompt?.trim() || DEFAULT_CONFIG.tutorSystemPrompt,
      tutorTemperature: clamp(Number(parsed.tutorTemperature ?? DEFAULT_CONFIG.tutorTemperature), 0, 2),
      tutorMaxTokens: clamp(Number(parsed.tutorMaxTokens ?? DEFAULT_CONFIG.tutorMaxTokens), 1, 4000)
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
    translationEndpoint: isSafeTranslationEndpoint(config.translationEndpoint.trim())
      ? config.translationEndpoint.trim()
      : DEFAULT_CONFIG.translationEndpoint,
    tutorEnabled: !!config.tutorEnabled,
    tutorProvider: config.tutorProvider || DEFAULT_CONFIG.tutorProvider,
    tutorEndpoint: isSafeTutorEndpoint(config.tutorEndpoint.trim()) ? config.tutorEndpoint.trim() : DEFAULT_CONFIG.tutorEndpoint,
    tutorApiKey: config.tutorApiKey.trim(),
    tutorApiVersion: config.tutorApiVersion.trim(),
    tutorDeploymentId: config.tutorDeploymentId.trim(),
    tutorModel: config.tutorModel.trim() || DEFAULT_CONFIG.tutorModel,
    tutorSystemPrompt: config.tutorSystemPrompt.trim() || DEFAULT_CONFIG.tutorSystemPrompt,
    tutorTemperature: clamp(Number(config.tutorTemperature), 0, 2),
    tutorMaxTokens: clamp(Number(config.tutorMaxTokens), 1, 4000)
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}
