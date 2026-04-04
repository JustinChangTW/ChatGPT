import { describe, expect, it } from 'vitest';
import { loadAIParamsConfig, saveAIParamsConfig } from '../lib/services/ai-params-config';

describe('ai params config storage', () => {
  it('loads defaults and clamps invalid values when saving', () => {
    const defaults = loadAIParamsConfig();
    expect(defaults.model).toBeTruthy();
    expect(defaults.translationEndpoint).toContain('{text}');

    const saved = saveAIParamsConfig({
      ...defaults,
      enabled: true,
      model: 'custom-model',
      temperature: 9,
      topP: -2,
      maxTokens: 0,
      sourceLang: 'en',
      targetLang: 'zh-TW',
      translationEndpoint: 'http://example.com?q={text}&langpair={source}|{target}',
      tutorEnabled: true,
      tutorProvider: 'openai',
      tutorEndpoint: 'http://insecure-endpoint.test/v1/chat/completions',
      tutorApiKey: '  test-key  ',
      tutorApiVersion: '',
      tutorDeploymentId: '',
      tutorModel: 'custom-tutor',
      tutorSystemPrompt: '  ',
      tutorTemperature: 99,
      tutorMaxTokens: -1
    });

    expect(saved.temperature).toBe(2);
    expect(saved.topP).toBe(0);
    expect(saved.maxTokens).toBe(1);
    expect(saved.translationEndpoint).toContain('api.mymemory.translated.net');
    expect(saved.tutorEndpoint).toContain('https://api.openai.com/v1/chat/completions');
    expect(saved.tutorApiKey).toBe('test-key');
    expect(saved.tutorProvider).toBe('openai');
    expect(saved.tutorModel).toBe('custom-tutor');
    expect(saved.tutorSystemPrompt).toBeTruthy();
    expect(saved.tutorTemperature).toBe(2);
    expect(saved.tutorMaxTokens).toBe(1);
  });
});
