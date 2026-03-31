export type DictionaryProviderKind = 'dictionaryapi_dev' | 'freedictionaryapi_com';

export type DictionaryProviderConfig = {
  id: string;
  name: string;
  enabled: boolean;
  kind: DictionaryProviderKind;
  endpoint: string;
};

const STORAGE_KEY = 'cct_dictionary_providers_v1';

const DEFAULT_PROVIDERS: DictionaryProviderConfig[] = [
  {
    id: 'provider-dictionaryapi-dev',
    name: 'DictionaryAPI.dev（主）',
    enabled: true,
    kind: 'dictionaryapi_dev',
    endpoint: 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}'
  },
  {
    id: 'provider-freedictionaryapi-com',
    name: 'FreeDictionaryAPI.com（備）',
    enabled: true,
    kind: 'freedictionaryapi_com',
    endpoint: 'https://freedictionaryapi.com/api/v1/entries/en/{word}'
  }
];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function isSafeProviderEndpoint(endpoint: string): boolean {
  if (!endpoint.includes('{word}')) return false;
  try {
    const url = new URL(endpoint.replace('{word}', 'example'));
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeProvider(provider: DictionaryProviderConfig): DictionaryProviderConfig {
  const endpoint = provider.endpoint.trim();
  return {
    id: provider.id.trim() || `provider-${Date.now()}`,
    name: provider.name.trim() || 'Unnamed Provider',
    enabled: !!provider.enabled,
    kind: provider.kind,
    endpoint: isSafeProviderEndpoint(endpoint)
      ? endpoint
      : provider.kind === 'freedictionaryapi_com'
        ? 'https://freedictionaryapi.com/api/v1/entries/en/{word}'
        : 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}'
  };
}

export function loadDictionaryProviders(): DictionaryProviderConfig[] {
  if (!isBrowser()) return DEFAULT_PROVIDERS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PROVIDERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PROVIDERS;
    return (parsed as DictionaryProviderConfig[]).map(normalizeProvider);
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

export function saveDictionaryProviders(providers: DictionaryProviderConfig[]): DictionaryProviderConfig[] {
  const normalized = providers.map(normalizeProvider);
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}
