export type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const STORAGE_KEY = 'cct_firebase_runtime_config_v1';

function isBrowser() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function loadFirebaseRuntimeConfig(): FirebaseRuntimeConfig | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FirebaseRuntimeConfig;
    if (Object.values(parsed).every((v) => typeof v === 'string' && v.length > 0)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFirebaseRuntimeConfig(config: FirebaseRuntimeConfig): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseRuntimeConfig(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
