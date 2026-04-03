import { describe, expect, it } from 'vitest';
import { loadDictionaryProviders, saveDictionaryProviders } from '../lib/services/dictionary-provider-config';

describe('dictionary provider config', () => {
  it('normalizes unsafe endpoints to known https defaults', () => {
    const saved = saveDictionaryProviders([
      {
        id: 'x',
        name: 'unsafe',
        enabled: true,
        kind: 'dictionaryapi_dev',
        endpoint: 'http://evil.local/{word}'
      }
    ]);
    expect(saved[0].endpoint).toContain('https://api.dictionaryapi.dev');
    const loaded = loadDictionaryProviders();
    expect(loaded[0].endpoint.startsWith('https://')).toBe(true);
  });
});
