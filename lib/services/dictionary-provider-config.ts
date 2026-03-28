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

export function loadDictionaryProviders(): DictionaryProviderConfig[] {
  if (!isBrowser()) return DEFAULT_PROVIDERS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PROVIDERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PROVIDERS;
    return parsed as DictionaryProviderConfig[];
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

export function saveDictionaryProviders(providers: DictionaryProviderConfig[]): DictionaryProviderConfig[] {
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  }
  return providers;
}

