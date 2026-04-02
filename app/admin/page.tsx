'use client';

import { ChangeEventHandler, DragEventHandler, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword, getRedirectResult, onAuthStateChanged, signInWithEmailAndPassword, signInWithRedirect, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { validateQuestionImport } from '@/lib/services/question-import-service';
import { appendQuestionBank, loadQuestionBank, replaceQuestionBank, resetQuestionBank } from '@/lib/services/local-question-bank';
import { resetLearningProgress } from '@/lib/services/learning-progress-storage';
import { hydrateLocalQuestionBankFromCloud, syncLocalQuestionBankToCloud } from '@/lib/services/question-bank-sync';
import { hydrateAllLocalDataFromCloud, syncAllLocalDataToCloud } from '@/lib/services/app-data-sync';
import { auth, googleProvider, hasFirebaseConfig } from '@/lib/firebase/client';
import { ensureFirebaseUser } from '@/lib/services/firebase-session';
import { chapterLabel, domainNoByName, parseChapterNo } from '@/lib/constants/cct-blueprint';
import {
  clearFirebaseRuntimeConfig,
  loadFirebaseRuntimeConfig,
  saveFirebaseRuntimeConfig
} from '@/lib/services/firebase-runtime-config';
import {
  DictionaryProviderConfig,
  DictionaryProviderKind,
  loadDictionaryProviders,
  saveDictionaryProviders
} from '@/lib/services/dictionary-provider-config';
import { AIParamsConfig, loadAIParamsConfig, saveAIParamsConfig } from '@/lib/services/ai-params-config';
import { CCTKnowledgeItem } from '@/lib/knowledge/cct-knowledge-base';
import { loadKnowledgeBaseEntries, resetKnowledgeBaseEntries, saveKnowledgeBaseEntries } from '@/lib/services/knowledge-base-storage';
import { diagnoseAITutorConfig, quickProbeAITutor, requestAITutorReply } from '@/lib/services/ai-tutor-client';

const importSchema = z.object({
  payload: z.string().min(2, '請貼上 JSON')
});

type ImportForm = z.infer<typeof importSchema>;
type FirebaseForm = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};
type EmailAuthForm = {
  email: string;
  password: string;
};
type EmailAuthFormErrors = {
  email?: string;
  password?: string;
};

export default function AdminPage() {
  const [result, setResult] = useState<string>('');
  const [subdomainFilter, setSubdomainFilter] = useState<string>('all');
  const [chapter, setChapter] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const [userLabel, setUserLabel] = useState<string>('未登入');
  const [isDragging, setIsDragging] = useState(false);
  const [showFirebaseSettings, setShowFirebaseSettings] = useState(false);
  const [isQuickChecking, setIsQuickChecking] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'sync' | 'api' | 'bank'>('sync');
  const [activeDataTab, setActiveDataTab] = useState<'question' | 'knowledge'>('question');
  const [currentHostname, setCurrentHostname] = useState('');
  const [dictionaryProviders, setDictionaryProviders] = useState<DictionaryProviderConfig[]>([]);
  const [aiParams, setAIParams] = useState<AIParamsConfig>(loadAIParamsConfig());
  const [knowledgeEntries, setKnowledgeEntries] = useState<CCTKnowledgeItem[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string>('');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeJson, setKnowledgeJson] = useState('');
  const [aiTestPrompt, setAiTestPrompt] = useState('請用 3 句話告訴我：為什麼我這題會錯？');
  const [aiTestResult, setAiTestResult] = useState('');
  const [isAiTesting, setIsAiTesting] = useState(false);
  const [emailAuthForm, setEmailAuthForm] = useState<EmailAuthForm>({ email: '', password: '' });
  const [emailAuthErrors, setEmailAuthErrors] = useState<EmailAuthFormErrors>({});
  const [firebaseForm, setFirebaseForm] = useState<FirebaseForm>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logAction = (action: string, status: 'start' | 'success' | 'fail', payload?: unknown) => {
    const now = new Date().toISOString();
    if (payload !== undefined) {
      console.log(`[AdminAction][${now}] ${action} -> ${status}`, payload);
      return;
    }
    console.log(`[AdminAction][${now}] ${action} -> ${status}`);
  };
  const runWithTimeout = async <T,>(action: string, task: Promise<T>, timeoutMs = 15000): Promise<T> => {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        window.setTimeout(() => reject(new Error(`${action} timeout (${timeoutMs}ms)`)), timeoutMs);
      })
    ]);
  };

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      logAction('window.error', 'fail', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      logAction('window.unhandledrejection', 'fail', { reason: String(event.reason) });
    };
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    setBank(loadQuestionBank());
    setCurrentHostname(typeof window !== 'undefined' ? window.location.hostname : '');
    const runtimeCfg = loadFirebaseRuntimeConfig();
    if (runtimeCfg) {
      setFirebaseForm(runtimeCfg);
    }
    setDictionaryProviders(loadDictionaryProviders());
    setAIParams(loadAIParamsConfig());
    const loadedKnowledge = loadKnowledgeBaseEntries();
    setKnowledgeEntries(loadedKnowledge);
    setSelectedKnowledgeId(loadedKnowledge[0]?.id ?? '');

    if (!auth) {
      setUserLabel('Firebase 未設定');
      return;
    }

    getRedirectResult(auth)
      .then((cred) => {
        if (!cred?.user) return;
        logAction('firebase.loginGoogle.redirectResult', 'success', { user: cred.user.email ?? cred.user.uid });
        setUserLabel(cred.user.email ?? cred.user.uid);
        setResult('Google 重新導向登入成功。');
      })
      .catch((err) => {
        logAction('firebase.loginGoogle.redirectResult', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      logAction('auth.stateChanged', 'success', { user: user?.email ?? user?.uid ?? 'none' });
      setUserLabel(user?.email ?? '未登入');
      if (!user) return;

      const pulled = await hydrateLocalQuestionBankFromCloud();
      if (pulled.ok && pulled.questions) {
        setBank(pulled.questions);
        setResult(`已從 Firebase 同步題庫，共 ${pulled.questions.length} 題`);
      }
    });

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      unsubscribe();
    };
  }, []);

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors }
  } = useForm<ImportForm>({
    resolver: zodResolver(importSchema)
  });

  const firebaseStatusText = !hasFirebaseConfig
    ? 'Firebase 未設定（NEXT_PUBLIC_FIREBASE_* 未注入）'
    : userLabel === '未登入'
      ? 'Firebase 已設定，尚未登入（同步時會自動匿名登入）'
      : `已登入：${userLabel}`;

  const chapterOptions = useMemo(() => [...new Set(bank.map((x) => x.chapter))], [bank]);
  const chapterInputListId = 'admin-chapter-options';
  const subdomainInputListId = 'admin-subdomain-options';

  const parseImportMeta = (q: Question): {
    questionNo: string | null;
    domainCode: string | null;
    subdomainCode: string | null;
    classificationMethod: string | null;
    classificationConfidence: string | null;
  } => {
    const questionNoMatch = q.id.match(/import-v2-\d+-(.+)-\d+$/);
    const domainCodeTag = q.tags.find((t) => t.startsWith('domain-'))?.replace('domain-', '') ?? null;
    const subdomainCodeTag = q.tags.find((t) => t.startsWith('subdomain-'))?.replace('subdomain-', '') ?? null;
    const classificationMethod =
      q.tags.find((t) => t.startsWith('classification-'))?.replace('classification-', '') ?? null;
    const classificationConfidence = q.tags.find((t) => t.startsWith('confidence-'))?.replace('confidence-', '') ?? null;

    return {
      questionNo: questionNoMatch?.[1] ?? null,
      domainCode: domainCodeTag,
      subdomainCode: subdomainCodeTag,
      classificationMethod,
      classificationConfidence
    };
  };

  const subdomainOptions = useMemo(
    () =>
      Array.from(
        new Map(
          bank.map((q) => {
            const meta = parseImportMeta(q);
            const key = meta.subdomainCode ? `code:${meta.subdomainCode}` : `name:${q.subdomain}`;
            return [
              key,
              {
                key,
                code: meta.subdomainCode,
                name: q.subdomain,
                label: meta.subdomainCode ? `${meta.subdomainCode} - ${q.subdomain}` : q.subdomain
              }
            ];
          })
        ).values()
      ).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [bank]
  );

  const loadFile = async (file: File) => {
    logAction('import.loadFile', 'start', { name: file.name, size: file.size });
    if (!file.name.endsWith('.json')) {
      logAction('import.loadFile', 'fail', { reason: 'not-json' });
      setResult('僅支援 .json 檔案');
      return;
    }

    const text = await file.text();
    setValue('payload', text, { shouldValidate: true });
    logAction('import.loadFile', 'success', { chars: text.length });
    setResult(`已讀取檔案：${file.name}`);
  };

  const onDropFile: DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await loadFile(file);
  };

  const onChooseFile: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (file) await loadFile(file);
  };

  const onSubmit = (values: ImportForm) => {
    logAction('import.submit', 'start');
    try {
      const parsed = JSON.parse(values.payload);
      const validated = validateQuestionImport(parsed);
      if (!validated.ok) {
        logAction('import.submit', 'fail', { reason: 'validate-fail', errors: validated.errors });
        setResult(`匯入失敗：${validated.errors.join('; ')}`);
        return;
      }

      const existing = loadQuestionBank();
      const shouldReplace =
        existing.length > 0 &&
        window.confirm(
          `目前已有 ${existing.length} 題。按「確定」會刪除舊資料並改用本次匯入；按「取消」則保留舊資料並合併去重。`
        );
      const merged = shouldReplace ? replaceQuestionBank(validated.questions) : appendQuestionBank(validated.questions);
      setBank(merged);
      logAction('import.submit', 'success', {
        imported: validated.questions.length,
        mode: shouldReplace ? 'replace' : 'merge',
        total: merged.length
      });
      setResult(
        `匯入成功，共 ${validated.questions.length} 題（格式：${validated.normalizedFrom}），` +
          `模式：${shouldReplace ? '覆蓋舊資料' : '合併舊資料'}，目前題庫總數：${merged.length}`
      );
    } catch {
      logAction('import.submit', 'fail', { reason: 'json-parse-fail' });
      setResult('JSON 格式錯誤');
    }
  };

  const updateDictionaryProvider = (id: string, patch: Partial<DictionaryProviderConfig>) => {
    setDictionaryProviders((prev) =>
      prev.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider))
    );
  };

  const moveDictionaryProvider = (id: string, direction: -1 | 1) => {
    setDictionaryProviders((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      return next;
    });
  };

  const addDictionaryProvider = () => {
    setDictionaryProviders((prev) => [
      ...prev,
      {
        id: `provider-custom-${Date.now()}`,
        name: '自訂 API',
        enabled: true,
        kind: 'dictionaryapi_dev',
        endpoint: 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}'
      }
    ]);
  };

  const saveDictionaryProviderSettings = () => {
    saveDictionaryProviders(dictionaryProviders);
    setResult('已儲存字典 API 設定（主/備援順序）。');
  };

  const saveAIParameterSettings = () => {
    const saved = saveAIParamsConfig(aiParams);
    setAIParams(saved);
    setResult('已儲存 AI 參數設定。');
  };

  const applyAITutorQuickPreset = (provider: AIParamsConfig['tutorProvider']) => {
    if (provider === 'openai') {
      setAIParams((prev) => ({
        ...prev,
        tutorProvider: 'openai',
        tutorEndpoint: 'https://api.openai.com/v1/chat/completions',
        tutorModel: 'gpt-4o-mini',
        tutorApiVersion: '',
        tutorDeploymentId: ''
      }));
      setResult('已套用 OpenAI 快速設定。請補上 API Key 後按「AI 助教連線自檢」。');
      return;
    }
    if (provider === 'anthropic') {
      setAIParams((prev) => ({
        ...prev,
        tutorProvider: 'anthropic',
        tutorEndpoint: 'https://api.anthropic.com/v1/messages',
        tutorModel: 'claude-3-5-sonnet-latest',
        tutorApiVersion: '2023-06-01',
        tutorDeploymentId: ''
      }));
      setResult('已套用 Anthropic 快速設定。請補上 API Key 後按「AI 助教連線自檢」。');
      return;
    }
    if (provider === 'google_gemini') {
      setAIParams((prev) => ({
        ...prev,
        tutorProvider: 'google_gemini',
        tutorEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}',
        tutorModel: 'gemini-1.5-pro',
        tutorApiVersion: '',
        tutorDeploymentId: ''
      }));
      setResult('已套用 Gemini 快速設定。請補上 API Key 後按「AI 助教連線自檢」。');
    }
  };

  const runAITutorQuickDebug = async () => {
    const diagnosis = diagnoseAITutorConfig();
    if (!diagnosis.ok) {
      setResult(`AI 助教設定檢查未過：${diagnosis.reason}。建議：${diagnosis.fix}`);
      return;
    }
    setResult('AI 助教連線自檢中…');
    const probe = await quickProbeAITutor();
    setResult(probe.ok ? `AI 助教連線成功：${probe.detail}` : `AI 助教連線失敗：${probe.detail}`);
  };

  const runAITutorDirectTest = async () => {
    const diagnosis = diagnoseAITutorConfig();
    if (!diagnosis.ok) {
      setAiTestResult(`❌ 設定未完成：${diagnosis.reason}\n👉 建議：${diagnosis.fix}`);
      return;
    }
    setIsAiTesting(true);
    setAiTestResult('測試中…請稍候');
    const reply = await requestAITutorReply(
      '【測試題】下列哪個選項最能降低社交工程風險？',
      '【測試詳解】應優先做員工安全意識訓練、MFA 與釣魚演練。',
      [{ role: 'user', text: aiTestPrompt.trim() || '請解釋這題重點' }]
    );
    setIsAiTesting(false);
    setAiTestResult(
      reply
        ? `✅ 測試成功，AI 有回覆：\n\n${reply}`
        : '❌ 測試失敗：沒有收到 AI 回覆。請檢查 API Key / 模型權限 / Endpoint / CORS（可先按「AI 助教連線自檢」）。'
    );
  };

  const filteredKnowledgeEntries = useMemo(() => {
    const q = knowledgeSearch.trim().toLowerCase();
    if (!q) return knowledgeEntries;
    return knowledgeEntries.filter((entry) =>
      [entry.title, entry.summary, ...entry.tags, ...entry.keyPoints, ...entry.examSignals].join(' ').toLowerCase().includes(q)
    );
  }, [knowledgeEntries, knowledgeSearch]);

  const selectedKnowledgeEntry = useMemo(
    () => knowledgeEntries.find((entry) => entry.id === selectedKnowledgeId) ?? null,
    [knowledgeEntries, selectedKnowledgeId]
  );

  const updateSelectedKnowledgeEntry = (
    patch: Partial<
      Pick<CCTKnowledgeItem, 'chapterNo' | 'chapterTitle' | 'title' | 'summary' | 'tags' | 'keyPoints' | 'examSignals'>
    >
  ) => {
    if (!selectedKnowledgeEntry) return;
    setKnowledgeEntries((prev) => prev.map((entry) => (entry.id === selectedKnowledgeEntry.id ? { ...entry, ...patch } : entry)));
  };

  const saveKnowledgeEntries = () => {
    const saved = saveKnowledgeBaseEntries(knowledgeEntries);
    setKnowledgeEntries(saved);
    setResult(`已儲存知識庫設定（${saved.length} 筆）。`);
  };

  const addKnowledgeEntry = () => {
    const id = `custom-kb-${Date.now()}`;
    const newEntry: CCTKnowledgeItem = {
      id,
      chapterNo: 1,
      chapterTitle: 'Custom Chapter',
      title: '新知識點',
      summary: '請填寫摘要',
      keyPoints: ['重點一'],
      examSignals: ['考題訊號'],
      tags: ['chapter-1', 'custom']
    };
    setKnowledgeEntries((prev) => [newEntry, ...prev]);
    setSelectedKnowledgeId(id);
    setResult('已新增知識點草稿。');
  };

  const importKnowledgeFromJson = () => {
    try {
      const parsed = JSON.parse(knowledgeJson);
      const normalized = Array.isArray(parsed) ? parsed : [parsed];
      if (normalized.length === 0) {
        setResult('知識庫 JSON 匯入失敗：內容不可為空。');
        return;
      }

      const imported = normalized as CCTKnowledgeItem[];
      const mergedMap = new Map(knowledgeEntries.map((entry) => [entry.id, entry]));
      let overwritten = 0;
      imported.forEach((entry) => {
        if (mergedMap.has(entry.id)) overwritten += 1;
        mergedMap.set(entry.id, entry);
      });
      const saved = saveKnowledgeBaseEntries(Array.from(mergedMap.values()));
      setKnowledgeEntries(saved);
      setSelectedKnowledgeId(saved[0]?.id ?? '');
      setResult(
        `知識庫 JSON 匯入成功：新增 ${imported.length - overwritten} 筆、覆蓋 ${overwritten} 筆（以 id 判定重覆），目前共 ${saved.length} 筆。`
      );
    } catch (err) {
      setResult(`知識庫 JSON 匯入失敗：${err instanceof Error ? err.message : '格式錯誤'}`);
    }
  };

  const exportKnowledgeToJson = () => {
    setKnowledgeJson(JSON.stringify(knowledgeEntries, null, 2));
    setResult('已匯出目前知識庫 JSON。');
  };

  const resetKnowledge = () => {
    const restored = resetKnowledgeBaseEntries();
    setKnowledgeEntries(restored);
    setSelectedKnowledgeId(restored[0]?.id ?? '');
    setResult('已還原預設知識庫。');
  };

  const list = useMemo(
    () =>
      bank.filter(
          (q) =>
          (subdomainFilter === 'all' ||
            parseImportMeta(q).subdomainCode === subdomainFilter ||
            q.subdomain === subdomainFilter) &&
          (chapter === 'all' || q.chapter === chapter) &&
          (type === 'all' || q.questionType === type)
      ),
    [bank, subdomainFilter, chapter, type]
  );

  const clearImported = () => {
    logAction('bank.clearImported', 'start');
    resetQuestionBank();
    const restored = loadQuestionBank();
    setBank(restored);
    logAction('bank.clearImported', 'success', { total: restored.length });
    setResult('已清除本機匯入題庫，回到預設 sample 題庫。');
  };

  const clearLearningProgress = () => {
    logAction('progress.reset', 'start');
    const confirmed = window.confirm('確定要重置目前學習進度嗎？這不會刪除題庫與 Firebase 設定。');
    if (!confirmed) {
      logAction('progress.reset', 'fail', { reason: 'user-cancelled' });
      setResult('已取消重置學習進度。');
      return;
    }

    const res = resetLearningProgress();
    logAction('progress.reset', 'success', { removed: res.removed.length });
    setResult(res.removed.length > 0 ? `已重置學習進度（${res.removed.length} 個項目）。` : '目前沒有可重置的學習進度資料。');
  };

  const loginGoogle = async () => {
    logAction('firebase.loginGoogle', 'start');
    if (!auth || !googleProvider) {
      logAction('firebase.loginGoogle', 'fail', { reason: 'firebase-not-configured' });
      setResult('Firebase 環境變數未設定，無法 Google 登入。');
      return;
    }

    try {
      await signInWithRedirect(auth, googleProvider);
      logAction('firebase.loginGoogle', 'success', { mode: 'redirect-started' });
      setResult('正在導向 Google 登入…完成授權後會回到此頁。');
    } catch (err) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const errCode = err instanceof FirebaseError ? err.code : '';
      const errMsg = err instanceof Error ? err.message : String(err);
      const looksUnauthorizedDomain =
        errCode === 'auth/unauthorized-domain' ||
        /not authorized for OAuth operations/i.test(errMsg) ||
        /authorized domains/i.test(errMsg);

      if (looksUnauthorizedDomain) {
        logAction('firebase.loginGoogle', 'fail', { reason: 'unauthorized-domain', hostname, errCode, errMsg });
        setResult(
          `Google 登入失敗：網域未授權。請到 Firebase Console -> Authentication -> Settings -> Authorized domains 加入 ${hostname}。`
        );
        return;
      }
      logAction('firebase.loginGoogle', 'fail', { reason: 'unknown', errCode, errMsg });
      setResult(
        `Google 登入失敗，請檢查 Firebase Auth 設定（Authorized domains、Google Provider、OAuth 同意畫面）。` +
          (errCode ? ` [${errCode}]` : '')
      );
    }
  };

  const loginWithEmailPassword = async () => {
    logAction('firebase.loginEmailPassword', 'start');
    if (!auth) {
      logAction('firebase.loginEmailPassword', 'fail', { reason: 'firebase-not-configured' });
      setResult('Firebase 未設定，無法進行帳號登入。');
      return;
    }
    const email = emailAuthForm.email.trim();
    const password = emailAuthForm.password;
    const nextErrors = validateEmailAuthForm(email, password);
    setEmailAuthErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult('請先修正帳號欄位錯誤後再登入。');
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUserLabel(cred.user.email ?? cred.user.uid);
      logAction('firebase.loginEmailPassword', 'success', { user: cred.user.email ?? cred.user.uid });
      setResult('Email/密碼登入成功。');
    } catch (err) {
      logAction('firebase.loginEmailPassword', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      setResult(`Email/密碼登入失敗：${toReadableAuthError(err)}`);
    }
  };

  const registerWithEmailPassword = async () => {
    logAction('firebase.registerEmailPassword', 'start');
    if (!auth) {
      logAction('firebase.registerEmailPassword', 'fail', { reason: 'firebase-not-configured' });
      setResult('Firebase 未設定，無法註冊帳號。');
      return;
    }
    const email = emailAuthForm.email.trim();
    const password = emailAuthForm.password;
    const nextErrors = validateEmailAuthForm(email, password);
    setEmailAuthErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult('請先修正帳號欄位錯誤後再建立帳號。');
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      setUserLabel(cred.user.email ?? cred.user.uid);
      logAction('firebase.registerEmailPassword', 'success', { user: cred.user.email ?? cred.user.uid });
      setResult('Email/密碼註冊成功，已自動登入。');
    } catch (err) {
      logAction('firebase.registerEmailPassword', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      setResult(`Email/密碼註冊失敗：${toReadableAuthError(err)}`);
    }
  };

  const connectAnonymous = async () => {
    logAction('firebase.connectAnonymous', 'start');
    const session = await ensureFirebaseUser();
    if (!session.ok) {
      logAction('firebase.connectAnonymous', 'fail', session);
      setResult('匿名連線 Firebase 失敗，請確認 Firebase Authentication 已啟用 Anonymous。');
      return;
    }
    setUserLabel(`匿名使用者 (${session.uid.slice(0, 8)}...)`);
    logAction('firebase.connectAnonymous', 'success', session);
    setResult('已建立匿名 Firebase 連線，可直接同步資料（不需 Google）。');
  };

  const logoutGoogle = async () => {
    logAction('firebase.logoutGoogle', 'start');
    if (!auth) {
      logAction('firebase.logoutGoogle', 'fail', { reason: 'firebase-not-configured' });
      setResult('Firebase 未設定，無需登出。');
      return;
    }

    try {
      await signOut(auth);
      setUserLabel('未登入');
      logAction('firebase.logoutGoogle', 'success');
      setResult('已登出 Google。');
    } catch (err) {
      logAction('firebase.logoutGoogle', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      setResult(`登出失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const pushCloud = async () => {
    logAction('firebase.pushQuestionBank', 'start');
    setResult('題庫同步中…（最多約 15 秒，完成後會顯示成功或失敗）');
    try {
      const res = await runWithTimeout('firebase.pushQuestionBank', syncLocalQuestionBankToCloud());
      logAction('firebase.pushQuestionBank', res.ok ? 'success' : 'fail', res);
      setResult(res.ok ? '已將本機題庫同步到 Firebase。' : `同步失敗：${res.reason}${res.error ? ` | ${res.error}` : ''}`);
    } catch (err) {
      logAction('firebase.pushQuestionBank', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      setResult(`同步失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const pullCloud = async () => {
    logAction('firebase.pullQuestionBank', 'start');
    setResult('題庫拉取中…（最多約 15 秒，完成後會顯示成功或失敗）');
    try {
      const res = await runWithTimeout('firebase.pullQuestionBank', hydrateLocalQuestionBankFromCloud());
      if (res.ok && res.questions) {
        setBank(res.questions);
        logAction('firebase.pullQuestionBank', 'success', { total: res.questions.length });
        setResult(`已從 Firebase 拉取題庫，共 ${res.questions.length} 題。`);
        return;
      }
      logAction('firebase.pullQuestionBank', 'fail', res);
      setResult(`拉取失敗：${res.reason}${res.error ? ` | ${res.error}` : ''}`);
    } catch (err) {
      logAction('firebase.pullQuestionBank', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      setResult(`拉取失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const pushAllCloud = async () => {
    logAction('firebase.pushAllData', 'start');
    setResult('全量同步中…（最多約 15 秒，完成後會顯示成功或失敗）');
    try {
      const res = await runWithTimeout('firebase.pushAllData', syncAllLocalDataToCloud());
      logAction('firebase.pushAllData', res.ok ? 'success' : 'fail', res);
      setResult(
        res.ok
          ? '已同步到 Firebase（共用資料：題庫/知識庫/單字庫/關鍵字/字典 API/AI 參數；個人資料：歷史/錯題本/章節進度）。'
          : `全量同步失敗：${res.reason}${res.error ? ` | ${res.error}` : ''}`
      );
    } catch (err) {
      logAction('firebase.pushAllData', 'fail', { reason: err instanceof Error ? err.message : String(err) });
      setResult(`全量同步失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    }
  };

  const allDataPulledSummary = (stats: NonNullable<Awaited<ReturnType<typeof hydrateAllLocalDataFromCloud>>['stats']>) =>
    `已從 Firebase 拉取資料：共用（題庫 ${stats.commonQuestionBank}、知識庫 ${stats.commonKnowledgeBase}、單字庫 ${stats.commonVocabularyBank}、關鍵字 ${stats.commonCustomKeywords}、字典API ${stats.commonDictionaryProviders}、AI參數 ${stats.commonAiParams ? '有' : '無'}）；個人（歷史 ${stats.personalPracticeAttempts}、錯題本 ${stats.personalWrongNotebook}、章節進度 ${stats.personalChapterProgress}）。`;

  const pullAllCloud = async () => {
    logAction('sync.pullAllData', 'start');
    setResult('全量資料拉取中…（最多約 15 秒，完成後會顯示成功或失敗）');
    try {
      const res = await runWithTimeout('sync.pullAllData', hydrateAllLocalDataFromCloud(), 15000);
      if (res.ok && res.stats) {
        logAction('sync.pullAllData', 'success', res.stats);
        setBank(loadQuestionBank());
        setResult(allDataPulledSummary(res.stats));
        return;
      }
      logAction('sync.pullAllData', 'fail', { reason: res.reason, error: res.error });
      setResult(`全量拉取失敗：${res.reason}${res.error ? ` | ${res.error}` : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logAction('sync.pullAllData', 'fail', { reason: msg });
      setResult(`全量拉取失敗：${msg}`);
    }
  };

  const saveFirebaseSettings = () => {
    logAction('firebase.saveRuntimeConfig', 'start');
    if (Object.values(firebaseForm).some((v) => !v.trim())) {
      logAction('firebase.saveRuntimeConfig', 'fail', { reason: 'empty-field' });
      setResult('Firebase 設定欄位不得為空。');
      return;
    }
    saveFirebaseRuntimeConfig(firebaseForm);
    logAction('firebase.saveRuntimeConfig', 'success', { projectId: firebaseForm.projectId });
    setResult('已儲存 Firebase 設定到瀏覽器。請重新整理頁面後再執行 Google 登入。');
  };

  const clearFirebaseSettings = () => {
    logAction('firebase.clearRuntimeConfig', 'start');
    clearFirebaseRuntimeConfig();
    logAction('firebase.clearRuntimeConfig', 'success');
    setResult('已清除瀏覽器中的 Firebase 設定。');
  };

  const copyCurrentDomain = async () => {
    logAction('firebase.copyCurrentDomain', 'start');
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    try {
      await navigator.clipboard.writeText(hostname);
      logAction('firebase.copyCurrentDomain', 'success', { hostname });
      setResult(`已複製網域：${hostname}`);
    } catch {
      logAction('firebase.copyCurrentDomain', 'fail', { hostname });
      setResult(`目前網域：${hostname}（請手動複製）`);
    }
  };

  const openFirebaseAuthSettings = () => {
    logAction('firebase.openAuthSettings', 'start');
    const pid = firebaseForm.projectId?.trim();
    if (!pid) {
      logAction('firebase.openAuthSettings', 'fail', { reason: 'project-id-empty' });
      setResult('無法開啟 Firebase Console：Project ID 為空，請先確認 Firebase 設定。');
      return;
    }
    const url = `https://console.firebase.google.com/project/${pid}/authentication/settings`;
    window.open(url, '_blank', 'noopener,noreferrer');
    logAction('firebase.openAuthSettings', 'success', { url });
    setResult('已開啟 Firebase Authentication 設定頁，請到 Authorized domains 加入目前網域。');
  };

  const runQuickCheck = async () => {
    logAction('diagnostic.quickCheck', 'start');
    setIsQuickChecking(true);
    const steps: Array<{ step: string; ok: boolean; detail: string }> = [];
    const pushStep = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail });

    try {
      pushStep('localStorage 可用', typeof window !== 'undefined' && !!window.localStorage, '本機儲存檢查');

      if (!hasFirebaseConfig) {
        pushStep('Firebase 設定', false, '未設定 NEXT_PUBLIC_FIREBASE_*');
      } else {
        pushStep('Firebase 設定', true, '已設定');

        const session = await runWithTimeout('diagnostic.ensureFirebaseUser', ensureFirebaseUser(), 10000);
        if (!session.ok) {
          pushStep('Firebase 身份', false, `${session.reason}${session.error ? ` | ${session.error}` : ''}`);
        } else {
          pushStep('Firebase 身份', true, `${session.mode} (${session.uid.slice(0, 8)}...)`);

          const pushAll = await runWithTimeout('diagnostic.pushAllData', syncAllLocalDataToCloud(), 15000);
          pushStep('全量同步到 Firebase', !!pushAll.ok, pushAll.ok ? '成功' : `${pushAll.reason}${pushAll.error ? ` | ${pushAll.error}` : ''}`);

          const pullAll = await runWithTimeout('diagnostic.pullAllData', hydrateAllLocalDataFromCloud(), 15000);
          pushStep(
            '全量從 Firebase 拉取',
            !!pullAll.ok,
            pullAll.ok && pullAll.stats
              ? `成功（共用：題庫${pullAll.stats.commonQuestionBank}/知識庫${pullAll.stats.commonKnowledgeBase}/單字${pullAll.stats.commonVocabularyBank}；個人：歷史${pullAll.stats.personalPracticeAttempts}/錯題本${pullAll.stats.personalWrongNotebook}/章節${pullAll.stats.personalChapterProgress}）`
              : `${pullAll.reason}${pullAll.error ? ` | ${pullAll.error}` : ''}`
          );
        }
      }
    } catch (err) {
      pushStep('快速測通流程', false, err instanceof Error ? err.message : String(err));
    } finally {
      setIsQuickChecking(false);
      console.table(steps);
      const summary = steps.map((s) => `${s.ok ? '✅' : '❌'} ${s.step}：${s.detail}`).join('；');
      logAction('diagnostic.quickCheck', steps.every((s) => s.ok) ? 'success' : 'fail', steps);
      setResult(`快速測通結果：${summary}`);
    }
  };

  const validateEmailAuthForm = (emailRaw: string, passwordRaw: string): EmailAuthFormErrors => {
    const errors: EmailAuthFormErrors = {};
    if (!emailRaw) {
      errors.email = '請輸入 Email。';
    } else {
      const simpleEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!simpleEmailPattern.test(emailRaw)) {
        errors.email = 'Email 格式不正確（需包含 @ 與網域）。';
      }
    }
    if (!passwordRaw) {
      errors.password = '請輸入密碼。';
    } else if (passwordRaw.length < 6) {
      errors.password = '密碼至少需要 6 碼。';
    }
    return errors;
  };

  const toReadableAuthError = (err: unknown): string => {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'auth/invalid-email':
          return 'Email 格式無效，請輸入正確 Email。';
        case 'auth/email-already-in-use':
          return '此 Email 已被註冊，請直接登入或改用其他 Email。';
        case 'auth/weak-password':
          return '密碼強度不足，請至少使用 6 碼以上。';
        case 'auth/operation-not-allowed':
          return 'Firebase 尚未啟用 Email/Password 登入方式。';
        case 'auth/too-many-requests':
          return '嘗試次數過多，請稍後再試。';
        case 'auth/network-request-failed':
          return '網路連線失敗，請確認網路後再試。';
        default:
          return `${err.message}（${err.code}）`;
      }
    }
    return err instanceof Error ? err.message : '未知錯誤';
  };

  const emailAuthValidationPreview = useMemo(
    () => validateEmailAuthForm(emailAuthForm.email.trim(), emailAuthForm.password),
    [emailAuthForm.email, emailAuthForm.password]
  );
  const emailAuthHasBlockingError = Object.keys(emailAuthValidationPreview).length > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin 題庫管理</h1>
      <p className="text-sm text-slate-500">依使用流程分區：先做身份與同步，再調整 API，最後做題庫匯入管理。</p>
      <div className="rounded-xl border bg-white p-2">
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {[
            { id: 'sync', label: 'A. 同步與登入' },
            { id: 'api', label: 'B. API 與 AI 參數' },
            { id: 'bank', label: 'C. 題庫匯入管理' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAdminTab(tab.id as 'sync' | 'api' | 'bank')}
              className={`rounded-lg px-3 py-2 text-left transition ${
                activeAdminTab === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeAdminTab === 'sync' && (
        <>
      <h2 className="text-lg font-semibold">A. Firebase 同步與登入</h2>
      <div className="rounded border bg-white p-3 text-sm">
        <p>目前狀態：{firebaseStatusText}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
          <button
            className="rounded border px-3 py-2"
            onClick={() =>
              setShowFirebaseSettings((v) => {
                const next = !v;
                setResult(next ? '已展開 Firebase 設定區。' : '已收合 Firebase 設定區。');
                return next;
              })
            }
          >
            {showFirebaseSettings ? '收合 Firebase 設定' : '展開 Firebase 設定'}
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={loginGoogle}
            disabled={!hasFirebaseConfig}
          >
            Google 登入（選用）
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={loginWithEmailPassword}
            disabled={!hasFirebaseConfig || emailAuthHasBlockingError}
          >
            帳密登入
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={registerWithEmailPassword}
            disabled={!hasFirebaseConfig || emailAuthHasBlockingError}
          >
            建立帳號
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={connectAnonymous}
            disabled={!hasFirebaseConfig}
          >
            匿名連線 Firebase（免 Google）
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={logoutGoogle}
            disabled={!hasFirebaseConfig}
          >
            登出
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={pushCloud}
            disabled={!hasFirebaseConfig}
          >
            同步到 Firebase
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={pullCloud}
            disabled={!hasFirebaseConfig}
          >
            從 Firebase 拉取
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={pushAllCloud}
            disabled={!hasFirebaseConfig}
          >
            全量同步到 Firebase
          </button>
          <button
            className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={pullAllCloud}
            disabled={!hasFirebaseConfig}
          >
            全量從 Firebase 拉取
          </button>
          <button
            className="rounded border border-emerald-300 px-3 py-2 text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={runQuickCheck}
            disabled={isQuickChecking}
          >
            {isQuickChecking ? '快速測通中…' : '快速測通（自動檢查）'}
          </button>
        </div>
        {!hasFirebaseConfig && (
          <p className="mt-2 text-xs text-slate-500">
            Google/Firebase 功能已停用。請先在 GitHub Actions Secrets 或 .env.local 設定
            NEXT_PUBLIC_FIREBASE_*。
          </p>
        )}
        {hasFirebaseConfig && (
          <div className="mt-2 grid gap-2 rounded border bg-slate-50 p-2 text-xs md:grid-cols-2">
            <label className="space-y-1">
              <span>Email（自建帳號）</span>
              <input
                className="w-full rounded border px-2 py-1"
                type="email"
                value={emailAuthForm.email}
                onChange={(e) =>
                  setEmailAuthForm((s) => {
                    const next = { ...s, email: e.target.value };
                    setEmailAuthErrors(validateEmailAuthForm(next.email.trim(), next.password));
                    return next;
                  })
                }
                placeholder="you@example.com"
              />
              {emailAuthErrors.email && <p className="text-[11px] text-red-600">{emailAuthErrors.email}</p>}
            </label>
            <label className="space-y-1">
              <span>Password（至少 6 碼）</span>
              <input
                className="w-full rounded border px-2 py-1"
                type="password"
                value={emailAuthForm.password}
                onChange={(e) =>
                  setEmailAuthForm((s) => {
                    const next = { ...s, password: e.target.value };
                    setEmailAuthErrors(validateEmailAuthForm(next.email.trim(), next.password));
                    return next;
                  })
                }
              />
              {emailAuthErrors.password && <p className="text-[11px] text-red-600">{emailAuthErrors.password}</p>}
            </label>
            <p className="md:col-span-2 text-slate-500">
              若你所在環境無法使用 Google，請先在 Firebase Authentication 啟用 Email/Password provider，再用此區建立帳號並登入。
            </p>
            {emailAuthHasBlockingError && <p className="md:col-span-2 text-[11px] text-amber-700">目前帳號欄位尚未通過檢查，請先修正後再登入/建立帳號。</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          不登入 Google 也可以：匯入題庫、章節練習、模擬考、錯題本與歷史分析都可在本機模式使用。
          同步到 Firebase 時，系統會優先使用現有登入，否則自動匿名登入。
        </p>
        {hasFirebaseConfig && (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <p>若 Google 登入失敗並出現 unauthorized-domain，請把目前網域加入 Firebase Authorized domains。</p>
            <p className="mt-1">
              目前網域：<span className="font-mono">{currentHostname || '-'}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded border border-amber-300 bg-white px-2 py-1" onClick={copyCurrentDomain}>
                複製目前網域
              </button>
              <button type="button" className="rounded border border-amber-300 bg-white px-2 py-1" onClick={openFirebaseAuthSettings}>
                開啟 Firebase Auth 設定
              </button>
            </div>
          </div>
        )}

        {showFirebaseSettings && (
          <div className="mt-3 grid gap-2 rounded border bg-slate-50 p-3 text-xs md:grid-cols-2">
            {(
              [
                ['apiKey', 'API Key'],
                ['authDomain', 'Auth Domain'],
                ['projectId', 'Project ID'],
                ['storageBucket', 'Storage Bucket'],
                ['messagingSenderId', 'Messaging Sender ID'],
                ['appId', 'App ID']
              ] as const
            ).map(([key, label]) => (
              <label className="space-y-1" key={key}>
                <span>{label}</span>
                <input
                  className="w-full rounded border px-2 py-1"
                  value={firebaseForm[key]}
                  onChange={(e) => setFirebaseForm((s) => ({ ...s, [key]: e.target.value }))}
                />
              </label>
            ))}

            <div className="md:col-span-2 grid gap-2 sm:flex">
              <button type="button" className="rounded bg-blue-600 px-3 py-2 text-white" onClick={saveFirebaseSettings}>
                儲存設定到瀏覽器
              </button>
              <button type="button" className="rounded border px-3 py-2" onClick={clearFirebaseSettings}>
                清除瀏覽器設定
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {activeAdminTab === 'api' && (
        <>
      <h2 className="text-lg font-semibold">B. 字典 API 設定（主 / 備援）</h2>
      <div className="rounded border bg-white p-3 text-sm">
        <p className="text-xs text-slate-500">
          會依下方順序嘗試字典 API（第 1 個為主，其餘為備援）。可新增其它同類型 API。URL 請使用 <code>{'{word}'}</code>。
        </p>
        <div className="mt-2 space-y-2">
          {dictionaryProviders.map((provider, idx) => (
            <div key={provider.id} className="rounded border bg-slate-50 p-2 text-xs">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">#{idx + 1}</span>
                <input
                  className="rounded border px-2 py-1"
                  value={provider.name}
                  onChange={(e) => updateDictionaryProvider(provider.id, { name: e.target.value })}
                />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={provider.enabled}
                    onChange={(e) => updateDictionaryProvider(provider.id, { enabled: e.target.checked })}
                  />
                  啟用
                </label>
                <select
                  className="rounded border px-2 py-1"
                  value={provider.kind}
                  onChange={(e) => updateDictionaryProvider(provider.id, { kind: e.target.value as DictionaryProviderKind })}
                >
                  <option value="dictionaryapi_dev">dictionaryapi.dev 格式</option>
                  <option value="freedictionaryapi_com">FreeDictionaryAPI.com 格式</option>
                </select>
              </div>
              <input
                className="w-full rounded border px-2 py-1"
                value={provider.endpoint}
                onChange={(e) => updateDictionaryProvider(provider.id, { endpoint: e.target.value })}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1" onClick={() => moveDictionaryProvider(provider.id, -1)}>
                  上移
                </button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => moveDictionaryProvider(provider.id, 1)}>
                  下移
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded border px-3 py-2" onClick={addDictionaryProvider}>
            新增 API
          </button>
          <button type="button" className="rounded bg-blue-600 px-3 py-2 text-white" onClick={saveDictionaryProviderSettings}>
            儲存 API 設定
          </button>
        </div>

        <div className="mt-4 rounded border bg-slate-50 p-3">
          <h3 className="text-sm font-semibold">B-2. AI 參數設定</h3>
          <p className="mt-1 text-xs text-slate-500">
            可在 Admin 設定 AI 參數（翻譯與 AI 助教：模型、提示詞、溫度、Token、Endpoint、API Key）。
          </p>
          <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
            <label className="space-y-1">
              <span>模型名稱</span>
              <input
                className="w-full rounded border px-2 py-1"
                value={aiParams.model}
                onChange={(e) => setAIParams((prev) => ({ ...prev, model: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span>啟用 AI 翻譯</span>
              <input
                type="checkbox"
                checked={aiParams.enabled}
                onChange={(e) => setAIParams((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
            </label>
            <label className="space-y-1">
              <span>Temperature（0~2）</span>
              <input
                className="w-full rounded border px-2 py-1"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={aiParams.temperature}
                onChange={(e) => setAIParams((prev) => ({ ...prev, temperature: Number(e.target.value) }))}
              />
            </label>
            <label className="space-y-1">
              <span>Top P（0~1）</span>
              <input
                className="w-full rounded border px-2 py-1"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={aiParams.topP}
                onChange={(e) => setAIParams((prev) => ({ ...prev, topP: Number(e.target.value) }))}
              />
            </label>
            <label className="space-y-1">
              <span>Max Tokens</span>
              <input
                className="w-full rounded border px-2 py-1"
                type="number"
                min={1}
                max={4000}
                step={1}
                value={aiParams.maxTokens}
                onChange={(e) => setAIParams((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))}
              />
            </label>
            <label className="space-y-1">
              <span>來源語系</span>
              <input
                className="w-full rounded border px-2 py-1"
                value={aiParams.sourceLang}
                onChange={(e) => setAIParams((prev) => ({ ...prev, sourceLang: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span>目標語系</span>
              <input
                className="w-full rounded border px-2 py-1"
                value={aiParams.targetLang}
                onChange={(e) => setAIParams((prev) => ({ ...prev, targetLang: e.target.value }))}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span>翻譯 API URL（支援 {'{text}'}、{'{source}'}、{'{target}'}）</span>
              <input
                className="w-full rounded border px-2 py-1"
                value={aiParams.translationEndpoint}
                onChange={(e) => setAIParams((prev) => ({ ...prev, translationEndpoint: e.target.value }))}
              />
            </label>
            <div className="md:col-span-2 mt-2 rounded border bg-white p-3">
              <p className="font-semibold">AI 助教（錯題本追問）</p>
              <p className="mt-1 text-slate-500">若未啟用或 API Key 為空，錯題本會自動使用離線助教回覆。</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded border bg-slate-900 px-2 py-1 text-white" onClick={() => applyAITutorQuickPreset('openai')}>
                  快速設定 OpenAI
                </button>
                <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => applyAITutorQuickPreset('anthropic')}>
                  快速設定 Claude
                </button>
                <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => applyAITutorQuickPreset('google_gemini')}>
                  快速設定 Gemini
                </button>
                <button type="button" className="rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-emerald-800" onClick={() => void runAITutorQuickDebug()}>
                  AI 助教連線自檢
                </button>
              </div>
              <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                <p className="font-semibold">幼幼班 4 步驟（先讓 AI 會動）</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                  <li>按「快速設定 OpenAI」</li>
                  <li>貼上 API Key（sk-...）</li>
                  <li>按「儲存 AI 參數」</li>
                  <li>按「AI 助教連線自檢」或下面「直接測試」</li>
                </ol>
              </div>
              <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-700">直接測試 AI 助教（不用去錯題本）</p>
                <textarea
                  className="mt-2 min-h-16 w-full rounded border bg-white p-2 text-xs"
                  value={aiTestPrompt}
                  onChange={(e) => setAiTestPrompt(e.target.value)}
                  placeholder="輸入測試問題，例如：為什麼我這題會錯？"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-blue-400 bg-blue-600 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void runAITutorDirectTest()}
                    disabled={isAiTesting}
                  >
                    {isAiTesting ? '測試中…' : '直接測試 AI 助教'}
                  </button>
                </div>
                {aiTestResult && <pre className="mt-2 whitespace-pre-wrap rounded border bg-white p-2 text-xs text-slate-700">{aiTestResult}</pre>}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span>啟用 AI 助教</span>
                  <input
                    type="checkbox"
                    checked={aiParams.tutorEnabled}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorEnabled: e.target.checked }))}
                  />
                </label>
                <label className="space-y-1">
                  <span>Provider</span>
                  <select
                    className="w-full rounded border px-2 py-1"
                    value={aiParams.tutorProvider}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorProvider: e.target.value as AIParamsConfig['tutorProvider'] }))}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="google_gemini">Google Gemini</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom_openai_compatible">Custom (OpenAI Compatible)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span>助教模型</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={aiParams.tutorModel}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorModel: e.target.value }))}
                    placeholder="gpt-4o-mini"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>API Endpoint</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={aiParams.tutorEndpoint}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorEndpoint: e.target.value }))}
                    placeholder={
                      aiParams.tutorProvider === 'google_gemini'
                        ? 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}'
                        : aiParams.tutorProvider === 'anthropic'
                          ? 'https://api.anthropic.com/v1/messages'
                          : aiParams.tutorProvider === 'azure_openai'
                            ? 'https://{resource}.openai.azure.com'
                            : 'https://api.openai.com/v1/chat/completions'
                    }
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>API Key</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    type="password"
                    value={aiParams.tutorApiKey}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorApiKey: e.target.value }))}
                    placeholder="sk-..."
                  />
                </label>
                <label className="space-y-1">
                  <span>API Version（Anthropic/Azure）</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={aiParams.tutorApiVersion}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorApiVersion: e.target.value }))}
                    placeholder={aiParams.tutorProvider === 'azure_openai' ? '2024-10-21' : '2023-06-01'}
                  />
                </label>
                <label className="space-y-1">
                  <span>Deployment ID（Azure 可選）</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={aiParams.tutorDeploymentId}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorDeploymentId: e.target.value }))}
                    placeholder="my-deployment"
                  />
                </label>
                <label className="space-y-1">
                  <span>助教 Temperature（0~2）</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={aiParams.tutorTemperature}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorTemperature: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1">
                  <span>助教 Max Tokens</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    type="number"
                    min={1}
                    max={4000}
                    step={1}
                    value={aiParams.tutorMaxTokens}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorMaxTokens: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>System Prompt（可客製助教風格）</span>
                  <textarea
                    className="min-h-24 w-full rounded border px-2 py-1"
                    value={aiParams.tutorSystemPrompt}
                    onChange={(e) => setAIParams((prev) => ({ ...prev, tutorSystemPrompt: e.target.value }))}
                  />
                </label>
                <div className="md:col-span-2 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-700">Provider API 規格對應（策略模式）</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    <li>OpenAI / OpenRouter / Custom：`chat/completions`，回應解析 `choices[0].message.content`。</li>
                    <li>Anthropic：`v1/messages`，Header 需 `x-api-key` + `anthropic-version`，解析 `content[].text`。</li>
                    <li>Google Gemini：`models/{'{model}'}:generateContent?key={'{apiKey}'}`，解析 `candidates[].content.parts[].text`。</li>
                    <li>Azure OpenAI：`/openai/deployments/{'{deployment}'}/chat/completions?api-version=...`，Header 用 `api-key`。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <button type="button" className="rounded bg-blue-600 px-3 py-2 text-white" onClick={saveAIParameterSettings}>
              儲存 AI 參數
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      {activeAdminTab === 'bank' && (
        <>
      <h2 className="text-lg font-semibold">C. 題庫匯入與資料管理</h2>
      <div className="rounded-xl border bg-white p-2">
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveDataTab('question')}
            className={`rounded-lg px-3 py-2 text-left transition ${
              activeDataTab === 'question' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            題庫匯入 / 題目列表
          </button>
          <button
            type="button"
            onClick={() => setActiveDataTab('knowledge')}
            className={`rounded-lg px-3 py-2 text-left transition ${
              activeDataTab === 'knowledge' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            知識庫維護 / JSON 匯入
          </button>
        </div>
      </div>

      {activeDataTab === 'question' && (
        <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 rounded border bg-white p-4">
        <div
          className={`rounded border-2 border-dashed p-4 text-center text-sm ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDropFile}
        >
          <p>拖曳 JSON 檔到這裡，或</p>
          <button
            type="button"
            className="mt-2 rounded border px-3 py-2"
            onClick={() => {
              setResult('請選擇 JSON 檔案。');
              fileInputRef.current?.click();
            }}
          >
            選擇檔案
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onChooseFile}
          />
        </div>

        <textarea
          className="h-32 w-full rounded border p-2 font-mono text-xs md:h-40"
          placeholder="貼上題庫 JSON（支援 full Question[]、simple-v1、simple-v2-blueprint）"
          {...register('payload')}
        />
        {errors.payload && <p className="text-sm text-red-600">{errors.payload.message}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">
            驗證並匯入
          </button>
          <button className="rounded border px-4 py-2" type="button" onClick={clearImported}>
            清除本機匯入題庫
          </button>
          <button className="rounded border border-red-300 px-4 py-2 text-red-700" type="button" onClick={clearLearningProgress}>
            重置學習進度
          </button>
        </div>
        {result && <p className="text-sm">{result}</p>}
      </form>
        </>
      )}

      {activeDataTab === 'knowledge' && (
      <div className="rounded border bg-white p-4">
        <h3 className="text-base font-semibold">C-2. 知識庫維護（可直接編輯 / JSON 匯入匯出）</h3>
        <p className="mt-1 text-xs text-slate-500">
          編輯後按「儲存知識庫」會寫入本機；知識庫頁會優先讀取這份資料。也可用 JSON 直接匯入/匯出。
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
          <li>左側先搜尋/選一筆知識點。</li>
          <li>右側直接改欄位（章節、標題、摘要、tags、重點、考題訊號）。</li>
          <li>按「儲存知識庫」生效；要批次維護可用下方 JSON 匯入/匯出。</li>
        </ol>
        <div className="mt-3 grid gap-3 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="搜尋知識點"
              value={knowledgeSearch}
              onChange={(e) => setKnowledgeSearch(e.target.value)}
            />
            <div className="max-h-80 space-y-1 overflow-auto rounded border bg-slate-50 p-2 text-xs">
              {filteredKnowledgeEntries.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  onClick={() => setSelectedKnowledgeId(entry.id)}
                  className={`w-full rounded px-2 py-1 text-left ${
                    selectedKnowledgeId === entry.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-200'
                  }`}
                >
                  CH{entry.chapterNo} · {entry.title}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={addKnowledgeEntry}>
                新增知識點
              </button>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={saveKnowledgeEntries}>
                儲存知識庫
              </button>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={resetKnowledge}>
                還原預設
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {selectedKnowledgeEntry ? (
              <div className="grid gap-2 text-xs md:grid-cols-2">
                <label className="space-y-1">
                  <span>Chapter No</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    type="number"
                    value={selectedKnowledgeEntry.chapterNo}
                    onChange={(e) => updateSelectedKnowledgeEntry({ chapterNo: Number(e.target.value) || 1 })}
                  />
                </label>
                <label className="space-y-1">
                  <span>Chapter Title</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={selectedKnowledgeEntry.chapterTitle}
                    onChange={(e) => updateSelectedKnowledgeEntry({ chapterTitle: e.target.value })}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>標題</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={selectedKnowledgeEntry.title}
                    onChange={(e) => updateSelectedKnowledgeEntry({ title: e.target.value })}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>摘要</span>
                  <textarea
                    className="h-20 w-full rounded border px-2 py-1"
                    value={selectedKnowledgeEntry.summary}
                    onChange={(e) => updateSelectedKnowledgeEntry({ summary: e.target.value })}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>Tags（逗號分隔）</span>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={selectedKnowledgeEntry.tags.join(', ')}
                    onChange={(e) => updateSelectedKnowledgeEntry({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>Key Points（每行一項）</span>
                  <textarea
                    className="h-20 w-full rounded border px-2 py-1"
                    value={selectedKnowledgeEntry.keyPoints.join('\n')}
                    onChange={(e) => updateSelectedKnowledgeEntry({ keyPoints: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span>Exam Signals（每行一項）</span>
                  <textarea
                    className="h-20 w-full rounded border px-2 py-1"
                    value={selectedKnowledgeEntry.examSignals.join('\n')}
                    onChange={(e) => updateSelectedKnowledgeEntry({ examSignals: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
                  />
                </label>
              </div>
            ) : (
              <p className="text-xs text-slate-500">請先從左側選擇一筆知識點。</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold">JSON 維護區</p>
          <p className="text-xs text-slate-500">若匯入資料的 id 與既有重覆，會以匯入內容覆蓋既有資料（upsert）。</p>
          <textarea
            className="h-40 w-full rounded border p-2 font-mono text-xs"
            placeholder="貼上知識庫 JSON（可單筆物件或陣列）後，點下方匯入。"
            value={knowledgeJson}
            onChange={(e) => setKnowledgeJson(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={importKnowledgeFromJson}>
              從 JSON 匯入
            </button>
            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={exportKnowledgeToJson}>
              匯出 JSON
            </button>
          </div>
        </div>
      </div>
      )}

      {activeDataTab === 'question' && (
        <>
      <div className="rounded border border-dashed bg-slate-50 p-3 text-xs text-slate-700">
        <p className="mb-1 font-semibold">simple-v2-blueprint 格式範例（可直接匯入）</p>
        <pre className="overflow-auto whitespace-pre-wrap">{`{
  "format": "simple-v2-blueprint",
  "sourceExam": "EC-Council CCT 212-82",
  "classificationReference": "CCTv1-Exam-Blueprint",
  "questions": [
    {
      "questionNo": 1,
      "chapterNo": 1,
      "domainCode": "1",
      "domain": "Information Security Threats and Attacks",
      "subdomainCode": "1.2",
      "subdomain": "Information Security Attacks",
      "question": "題目文字",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": "A",
      "explanation": "詳解",
      "questionType": "theory",
      "difficulty": "medium",
      "keywords": ["sql injection"],
      "tags": ["chapter-1", "domain-information-security-threats-and-attacks", "subdomain-1.2"],
      "sourceType": "original",
      "classificationMethod": "blueprint_inference_from_question_text",
      "classificationConfidence": "high"
    }
  ]
}`}</pre>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded border p-2">
          <p className="mb-1 text-xs text-slate-500">Chapter（可搜尋）</p>
          <div className="flex gap-2">
            <input
              className="w-full rounded border px-2 py-1"
              list={chapterInputListId}
              value={chapter === 'all' ? '' : chapter}
              onChange={(e) => setChapter(e.target.value ? e.target.value : 'all')}
              placeholder="輸入或選擇 chapter"
            />
            <button
              className="shrink-0 rounded border px-2 py-1 text-xs"
              type="button"
              onClick={() => {
                setChapter('all');
                setResult('已重置 Chapter 篩選。');
              }}
            >
              全部
            </button>
          </div>
          <datalist id={chapterInputListId}>
            {chapterOptions.map((x) => (
              <option key={x} value={x} label={chapterLabel(x)} />
            ))}
          </datalist>
        </div>
        <div className="rounded border p-2">
          <p className="mb-1 text-xs text-slate-500">Subdomain code（可搜尋）</p>
          <div className="flex gap-2">
            <input
              className="w-full rounded border px-2 py-1"
              list={subdomainInputListId}
              value={subdomainFilter === 'all' ? '' : subdomainFilter}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  setSubdomainFilter('all');
                  return;
                }
                const fromLabel = raw.includes(' - ') ? raw.split(' - ')[0] : raw;
                setSubdomainFilter(fromLabel);
              }}
              placeholder="輸入 subdomain code 或名稱"
            />
            <button
              className="shrink-0 rounded border px-2 py-1 text-xs"
              type="button"
              onClick={() => {
                setSubdomainFilter('all');
                setResult('已重置 Subdomain 篩選。');
              }}
            >
              全部
            </button>
          </div>
          <datalist id={subdomainInputListId}>
            {subdomainOptions.map((x) => (
              <option key={x.key} value={x.label} />
            ))}
          </datalist>
        </div>
        <select className="rounded border p-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All type</option>
          <option value="theory">theory</option>
          <option value="practical">practical</option>
        </select>
      </div>
        </>
      )}
        </>
      )}

      {activeDataTab === 'question' && (
      <div className="rounded border bg-white p-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">題目列表（{list.length}）</p>
          <p className="text-xs text-slate-500">改為卡片資訊層級：題號/章節/Domain/Subdomain/型態</p>
        </div>
        <ul className="space-y-2">
          {list.map((q) => (
            <li key={q.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {(() => {
                const meta = parseImportMeta(q);
                const domainCode = meta.domainCode ?? String(parseChapterNo(q.chapter) ?? domainNoByName(q.domain) ?? '-');
                return (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-white">{meta.questionNo ? `Q${meta.questionNo}` : q.id}</span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{chapterLabel(q.chapter)}</span>
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">D{domainCode}</span>
                      {meta.subdomainCode ? <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700">S{meta.subdomainCode}</span> : null}
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{q.questionType}</span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{q.sourceType}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{q.domain}</p>
                    <p className="text-sm text-slate-600">{q.subdomain}</p>
                    <p className="truncate text-xs text-slate-500">{q.id}</p>
                    {meta.classificationConfidence ? (
                      <p className="text-xs text-slate-500">confidence: {meta.classificationConfidence}</p>
                    ) : null}
                  </div>
                );
              })()}
            </li>
          ))}
        </ul>
      </div>
      )}
    </div>
  );
}
