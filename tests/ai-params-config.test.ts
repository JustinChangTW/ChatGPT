import { describe, expect, it } from 'vitest';
import { loadAIParamsConfig, saveAIParamsConfig } from '../lib/services/ai-params-config';

describe('ai params config storage', () => {
  it('loads defaults and clamps invalid values when saving', () => {
    const defaults = loadAIParamsConfig();
    expect(defaults.model).toBeTruthy();
    expect(defaults.translationEndpoint).toContain('{text}');

    const saved = saveAIParamsConfig({
      enabled: true,
      model: 'custom-model',
      temperature: 9,
      topP: -2,
      maxTokens: 0,
      sourceLang: 'en',
      targetLang: 'zh-TW',
      translationEndpoint: 'https://example.com?q={text}&langpair={source}|{target}'
    });

    expect(saved.temperature).toBe(2);
    expect(saved.topP).toBe(0);
    expect(saved.maxTokens).toBe(1);
  });
});
