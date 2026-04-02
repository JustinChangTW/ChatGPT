import { AIParamsConfig, loadAIParamsConfig } from '@/lib/services/ai-params-config';

export type ChatTurn = { role: 'user' | 'assistant'; text: string };
export type AITutorDiagnosis = { ok: true } | { ok: false; reason: string; fix: string };

type ProviderAdapter = {
  buildRequest: (
    cfg: AIParamsConfig,
    prompt: { system: string; user: string }
  ) => { url: string; init: RequestInit };
  parseResponse: (payload: unknown) => string;
};

function readableApiError(detail: unknown): string {
  const payload = detail as { error?: { message?: string; code?: string; type?: string } };
  const code = payload.error?.code ?? payload.error?.type ?? '';
  const message = payload.error?.message ?? '';
  if (code === 'insufficient_quota') {
    return 'API 額度不足（insufficient_quota）。請到 OpenAI Billing/Usage 檢查是否已超額或尚未開通付費。';
  }
  if (code === 'invalid_api_key') {
    return 'API Key 無效（invalid_api_key）。請確認 key 是否正確、未撤銷。';
  }
  if (code === 'model_not_found') {
    return '模型不存在或無權限（model_not_found）。請確認模型名稱與帳號權限。';
  }
  if (message) return `${message}${code ? `（${code}）` : ''}`;
  return '未知錯誤（請檢查 API Key / 模型 / Endpoint / 配額）';
}

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
  const result = await requestAITutorReplyDebug(question, explanation, history);
  return result.reply;
}

export async function requestAITutorReplyDebug(
  question: string,
  explanation: string,
  history: ChatTurn[]
): Promise<{ reply: string | null; error: string | null }> {
  const cfg = loadAIParamsConfig();
  if (!cfg.tutorEnabled || !cfg.tutorApiKey.trim()) return { reply: null, error: 'AI 助教未啟用或 API Key 為空。' };

  const userPrompt = `題目：${question}\n詳解：${explanation}\n對話歷史：${history.map((x) => `${x.role}: ${x.text}`).join('\n')}`;
  const adapter = adapters[cfg.tutorProvider];
  try {
    const { url, init } = adapter.buildRequest(cfg, { system: cfg.tutorSystemPrompt, user: userPrompt });
    const response = await fetch(url, init);
    if (!response.ok) {
      let detail: unknown = null;
      try {
        detail = await response.json();
      } catch {
        detail = null;
      }
      return { reply: null, error: `HTTP ${response.status}：${readableApiError(detail)}` };
    }
    const payload = await response.json();
    const parsed = adapter.parseResponse(payload);
    return { reply: parsed || null, error: parsed ? null : '有回應但解析不到內容（請檢查 provider 回傳格式）。' };
  } catch (err) {
    return { reply: null, error: `請求失敗：${err instanceof Error ? err.message : String(err)}` };
  }
}

export function diagnoseAITutorConfig(): AITutorDiagnosis {
  const cfg = loadAIParamsConfig();
  if (!cfg.tutorEnabled) {
    return { ok: false, reason: 'AI 助教尚未啟用', fix: '到 Admin 勾選「啟用 AI 助教」。' };
  }
  if (!cfg.tutorApiKey.trim()) {
    return { ok: false, reason: 'API Key 為空', fix: '到 Admin 的 AI 助教設定填入有效 API Key。' };
  }
  if (!cfg.tutorModel.trim()) {
    return { ok: false, reason: '模型名稱為空', fix: '到 Admin 填入模型，例如 gpt-4o-mini。' };
  }
  if (!cfg.tutorEndpoint.trim() && cfg.tutorProvider !== 'azure_openai') {
    return { ok: false, reason: 'Endpoint 為空', fix: '到 Admin 填入對應 Provider Endpoint 或使用快速設定。' };
  }
  if (cfg.tutorProvider === 'azure_openai' && !cfg.tutorEndpoint.includes('openai.azure.com')) {
    return { ok: false, reason: 'Azure Endpoint 格式不符', fix: 'Azure 應為 https://{resource}.openai.azure.com' };
  }
  return { ok: true };
}

export async function quickProbeAITutor(): Promise<{ ok: boolean; detail: string }> {
  const diagnosis = diagnoseAITutorConfig();
  if (!diagnosis.ok) return { ok: false, detail: `${diagnosis.reason}｜${diagnosis.fix}` };
  const result = await requestAITutorReplyDebug('請用一句話回覆：AI 連線測試成功', '這是系統連線測試，不需解題。', [
    { role: 'user', text: '連線測試' }
  ]);
  if (!result.reply) return { ok: false, detail: result.error ?? '請求已送出但未取得回覆。' };
  return { ok: true, detail: `成功：${result.reply.slice(0, 60)}${result.reply.length > 60 ? '…' : ''}` };
}
