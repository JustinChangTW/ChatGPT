import { AIParamsConfig, loadAIParamsConfig } from '@/lib/services/ai-params-config';

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

type ProviderAdapter = {
  buildRequest: (
    cfg: AIParamsConfig,
    prompt: { system: string; user: string }
  ) => { url: string; init: RequestInit };
  parseResponse: (payload: unknown) => string;
};

const buildOpenAICompatibleMessages = (systemPrompt: string, userPrompt: string) => [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
];

const adapters: Record<AIParamsConfig['tutorProvider'], ProviderAdapter> = {
  openai: {
    buildRequest: (cfg, prompt) => ({
      url: cfg.tutorEndpoint || 'https://api.openai.com/v1/chat/completions',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.tutorApiKey}`
        },
        body: JSON.stringify({
          model: cfg.tutorModel,
          temperature: cfg.tutorTemperature,
          max_tokens: cfg.tutorMaxTokens,
          messages: buildOpenAICompatibleMessages(prompt.system, prompt.user)
        })
      }
    }),
    parseResponse: (payload) =>
      ((payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '').trim()
  },
  openrouter: {
    buildRequest: (cfg, prompt) => ({
      url: cfg.tutorEndpoint || 'https://openrouter.ai/api/v1/chat/completions',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.tutorApiKey}`
        },
        body: JSON.stringify({
          model: cfg.tutorModel,
          temperature: cfg.tutorTemperature,
          max_tokens: cfg.tutorMaxTokens,
          messages: buildOpenAICompatibleMessages(prompt.system, prompt.user)
        })
      }
    }),
    parseResponse: (payload) =>
      ((payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '').trim()
  },
  custom_openai_compatible: {
    buildRequest: (cfg, prompt) => ({
      url: cfg.tutorEndpoint,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.tutorApiKey}`
        },
        body: JSON.stringify({
          model: cfg.tutorModel,
          temperature: cfg.tutorTemperature,
          max_tokens: cfg.tutorMaxTokens,
          messages: buildOpenAICompatibleMessages(prompt.system, prompt.user)
        })
      }
    }),
    parseResponse: (payload) =>
      ((payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '').trim()
  },
  anthropic: {
    buildRequest: (cfg, prompt) => ({
      url: cfg.tutorEndpoint || 'https://api.anthropic.com/v1/messages',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.tutorApiKey,
          'anthropic-version': cfg.tutorApiVersion || '2023-06-01'
        },
        body: JSON.stringify({
          model: cfg.tutorModel,
          max_tokens: cfg.tutorMaxTokens,
          temperature: cfg.tutorTemperature,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }]
        })
      }
    }),
    parseResponse: (payload) => {
      const content = (payload as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
      return (content.find((x) => x.type === 'text')?.text ?? '').trim();
    }
  },
  google_gemini: {
    buildRequest: (cfg, prompt) => {
      const base = cfg.tutorEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}';
      const url = base.replace('{model}', encodeURIComponent(cfg.tutorModel)).replace('{apiKey}', encodeURIComponent(cfg.tutorApiKey));
      return {
        url,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${prompt.system}\n\n${prompt.user}` }] }],
            generationConfig: { temperature: cfg.tutorTemperature, maxOutputTokens: cfg.tutorMaxTokens }
          })
        }
      };
    },
    parseResponse: (payload) =>
      ((payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
  },
  azure_openai: {
    buildRequest: (cfg, prompt) => {
      const deployment = cfg.tutorDeploymentId?.trim() || cfg.tutorModel;
      const base = cfg.tutorEndpoint || 'https://{resource}.openai.azure.com';
      const endpoint = base.endsWith('/') ? base.slice(0, -1) : base;
      const apiVersion = cfg.tutorApiVersion || '2024-10-21';
      return {
        url: `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': cfg.tutorApiKey
          },
          body: JSON.stringify({
            temperature: cfg.tutorTemperature,
            max_tokens: cfg.tutorMaxTokens,
            messages: buildOpenAICompatibleMessages(prompt.system, prompt.user)
          })
        }
      };
    },
    parseResponse: (payload) =>
      ((payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '').trim()
  }
};

export async function requestAITutorReply(question: string, explanation: string, history: ChatTurn[]): Promise<string | null> {
  const cfg = loadAIParamsConfig();
  if (!cfg.tutorEnabled || !cfg.tutorApiKey.trim()) return null;

  const userPrompt = `題目：${question}\n詳解：${explanation}\n對話歷史：${history.map((x) => `${x.role}: ${x.text}`).join('\n')}`;
  const adapter = adapters[cfg.tutorProvider];
  try {
    const { url, init } = adapter.buildRequest(cfg, { system: cfg.tutorSystemPrompt, user: userPrompt });
    const response = await fetch(url, init);
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = adapter.parseResponse(payload);
    return parsed || null;
  } catch {
    return null;
  }
}
