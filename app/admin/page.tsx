'use client';

import { ChangeEventHandler, DragEventHandler, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { validateQuestionImport } from '@/lib/services/question-import-service';
import { appendQuestionBank, loadQuestionBank, resetQuestionBank } from '@/lib/services/local-question-bank';
import { hydrateLocalQuestionBankFromCloud, syncLocalQuestionBankToCloud } from '@/lib/services/question-bank-sync';
import { auth, googleProvider, hasFirebaseConfig } from '@/lib/firebase/client';
import { CCT_DOMAIN_BLUEPRINT, chapterLabel, domainLabel, domainNoByName, parseChapterNo } from '@/lib/constants/cct-blueprint';
import {
  clearFirebaseRuntimeConfig,
  loadFirebaseRuntimeConfig,
  saveFirebaseRuntimeConfig
} from '@/lib/services/firebase-runtime-config';

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

export default function AdminPage() {
  const [result, setResult] = useState<string>('');
  const [domain, setDomain] = useState<string>('all');
  const [chapter, setChapter] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const [userLabel, setUserLabel] = useState<string>('未登入');
  const [isDragging, setIsDragging] = useState(false);
  const [showFirebaseSettings, setShowFirebaseSettings] = useState(false);
  const [firebaseForm, setFirebaseForm] = useState<FirebaseForm>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBank(loadQuestionBank());
    const runtimeCfg = loadFirebaseRuntimeConfig();
    if (runtimeCfg) {
      setFirebaseForm(runtimeCfg);
    }

    if (!auth) {
      setUserLabel('Firebase 未設定');
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      setUserLabel(user?.email ?? '未登入');
      if (!user) return;

      const pulled = await hydrateLocalQuestionBankFromCloud();
      if (pulled.ok && pulled.questions) {
        setBank(pulled.questions);
        setResult(`已從 Firebase 同步題庫，共 ${pulled.questions.length} 題`);
      }
    });
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
      ? 'Firebase 已設定，尚未登入'
      : `已登入：${userLabel}`;

  const chapterOptions = useMemo(() => [...new Set(bank.map((x) => x.chapter))], [bank]);
  const domainOptions = useMemo(() => [...new Set(bank.map((x) => x.domain))], [bank]);

  const linkedDomains = useMemo(() => {
    if (chapter === 'all') return domainOptions;
    const chapterNo = parseChapterNo(chapter);
    const blueprintDomain = CCT_DOMAIN_BLUEPRINT.find((d) => d.domainNo === chapterNo)?.domain;
    if (!blueprintDomain) return domainOptions;

    return domainOptions.includes(blueprintDomain) ? [blueprintDomain] : domainOptions;
  }, [chapter, domainOptions]);

  useEffect(() => {
    if (domain !== 'all' && !linkedDomains.includes(domain)) {
      setDomain('all');
    }
  }, [domain, linkedDomains]);

  const loadFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setResult('僅支援 .json 檔案');
      return;
    }

    const text = await file.text();
    setValue('payload', text, { shouldValidate: true });
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
    try {
      const parsed = JSON.parse(values.payload);
      const validated = validateQuestionImport(parsed);
      if (!validated.ok) {
        setResult(`匯入失敗：${validated.errors.join('; ')}`);
        return;
      }

      const merged = appendQuestionBank(validated.questions);
      setBank(merged);
      setResult(`匯入成功，共 ${validated.questions.length} 題（格式：${validated.normalizedFrom}），目前題庫總數：${merged.length}`);
    } catch {
      setResult('JSON 格式錯誤');
    }
  };

  const list = useMemo(
    () =>
      bank.filter(
        (q) =>
          (domain === 'all' || q.domain === domain) &&
          (chapter === 'all' || q.chapter === chapter) &&
          (type === 'all' || q.questionType === type)
      ),
    [bank, domain, chapter, type]
  );

  const clearImported = () => {
    resetQuestionBank();
    const restored = loadQuestionBank();
    setBank(restored);
    setResult('已清除本機匯入題庫，回到預設 sample 題庫。');
  };

  const loginGoogle = async () => {
    if (!auth || !googleProvider) {
      setResult('Firebase 環境變數未設定，無法 Google 登入。');
      return;
    }

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUserLabel(cred.user.email ?? cred.user.uid);
      setResult('Google 登入成功，可同步 Firebase 題庫。');
    } catch {
      setResult('Google 登入失敗，請檢查 Firebase Auth 設定。');
    }
  };

  const logoutGoogle = async () => {
    if (!auth) {
      setResult('Firebase 未設定，無需登出。');
      return;
    }

    await signOut(auth);
    setUserLabel('未登入');
    setResult('已登出 Google。');
  };

  const pushCloud = async () => {
    const res = await syncLocalQuestionBankToCloud();
    setResult(res.ok ? '已將本機題庫同步到 Firebase。' : `同步失敗：${res.reason}`);
  };

  const pullCloud = async () => {
    const res = await hydrateLocalQuestionBankFromCloud();
    if (res.ok && res.questions) {
      setBank(res.questions);
      setResult(`已從 Firebase 拉取題庫，共 ${res.questions.length} 題。`);
      return;
    }
    setResult(`拉取失敗：${res.reason}`);
  };

  const saveFirebaseSettings = () => {
    if (Object.values(firebaseForm).some((v) => !v.trim())) {
      setResult('Firebase 設定欄位不得為空。');
      return;
    }
    saveFirebaseRuntimeConfig(firebaseForm);
    setResult('已儲存 Firebase 設定到瀏覽器。請重新整理頁面後再執行 Google 登入。');
  };

  const clearFirebaseSettings = () => {
    clearFirebaseRuntimeConfig();
    setResult('已清除瀏覽器中的 Firebase 設定。');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin 題庫管理</h1>
      <div className="rounded border bg-white p-3 text-sm">
        <p>目前狀態：{firebaseStatusText}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className="rounded border px-3 py-1"
            onClick={() => setShowFirebaseSettings((v) => !v)}
          >
            {showFirebaseSettings ? '收合 Firebase 設定' : '展開 Firebase 設定'}
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={loginGoogle}
            disabled={!hasFirebaseConfig}
          >
            Google 登入
          </button>
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={logoutGoogle}
            disabled={!hasFirebaseConfig}
          >
            登出
          </button>
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={pushCloud}
            disabled={!hasFirebaseConfig}
          >
            同步到 Firebase
          </button>
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={pullCloud}
            disabled={!hasFirebaseConfig}
          >
            從 Firebase 拉取
          </button>
        </div>
        {!hasFirebaseConfig && (
          <p className="mt-2 text-xs text-slate-500">
            Google/Firebase 功能已停用。請先在 GitHub Actions Secrets 或 .env.local 設定
            NEXT_PUBLIC_FIREBASE_*。
          </p>
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

            <div className="md:col-span-2 flex gap-2">
              <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={saveFirebaseSettings}>
                儲存設定到瀏覽器
              </button>
              <button type="button" className="rounded border px-3 py-1" onClick={clearFirebaseSettings}>
                清除瀏覽器設定
              </button>
            </div>
          </div>
        )}
      </div>

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
            className="mt-2 rounded border px-3 py-1"
            onClick={() => fileInputRef.current?.click()}
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
          className="h-40 w-full rounded border p-2 font-mono text-xs"
          placeholder="貼上題庫 JSON（支援 full Question[] 或 simple-v1）"
          {...register('payload')}
        />
        {errors.payload && <p className="text-sm text-red-600">{errors.payload.message}</p>}
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">
            驗證並匯入
          </button>
          <button className="rounded border px-4 py-2" type="button" onClick={clearImported}>
            清除本機匯入題庫
          </button>
        </div>
        {result && <p className="text-sm">{result}</p>}
      </form>

      <div className="rounded border border-dashed bg-slate-50 p-3 text-xs text-slate-700">
        <p className="mb-1 font-semibold">simple-v1 格式範例（可直接匯入）</p>
        <pre className="overflow-auto whitespace-pre-wrap">{`{
  "format": "simple-v1",
  "questions": [
    {
      "chapterNo": 1,
      "question": "題目文字",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": "A",
      "explanation": "詳解"
    }
  ]
}`}</pre>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <select className="rounded border p-2" value={chapter} onChange={(e) => setChapter(e.target.value)}>
          <option value="all">All chapter</option>
          {chapterOptions.map((x) => (
            <option key={x} value={x}>
              {chapterLabel(x)}
            </option>
          ))}
        </select>
        <select className="rounded border p-2" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="all">All domain</option>
          {linkedDomains.map((x) => (
            <option key={x} value={x}>
              {domainLabel(x)}
            </option>
          ))}
        </select>
        <select className="rounded border p-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All type</option>
          <option value="theory">theory</option>
          <option value="practical">practical</option>
        </select>
      </div>

      <div className="rounded border bg-white p-4 text-sm">
        <p className="mb-2 font-semibold">題目列表（{list.length}）</p>
        <ul className="space-y-1">
          {list.map((q) => (
            <li key={q.id}>
              {q.id} | {chapterLabel(q.chapter)} | [D{domainNoByName(q.domain) ?? '-'}] {q.domain} | {q.questionType} | {q.sourceType}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
