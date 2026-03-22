'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { validateQuestionImport } from '@/lib/services/question-import-service';
import { appendQuestionBank, loadQuestionBank, resetQuestionBank } from '@/lib/services/local-question-bank';
import { hydrateLocalQuestionBankFromCloud, syncLocalQuestionBankToCloud } from '@/lib/services/question-bank-sync';
import { auth, googleProvider } from '@/lib/firebase/client';

const importSchema = z.object({
  payload: z.string().min(2, '請貼上 JSON')
});

type ImportForm = z.infer<typeof importSchema>;

export default function AdminPage() {
  const [result, setResult] = useState<string>('');
  const [domain, setDomain] = useState<string>('all');
  const [chapter, setChapter] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const [userLabel, setUserLabel] = useState<string>('未登入');

  useEffect(() => {
    setBank(loadQuestionBank());

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

  const { register, handleSubmit, formState: { errors } } = useForm<ImportForm>({
    resolver: zodResolver(importSchema)
  });

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

  const list = useMemo(() => bank.filter((q) =>
    (domain === 'all' || q.domain === domain) &&
    (chapter === 'all' || q.chapter === chapter) &&
    (type === 'all' || q.questionType === type)
  ), [bank, domain, chapter, type]);

  const clearImported = () => {
    resetQuestionBank();
    const restored = loadQuestionBank();
    setBank(restored);
    setResult('已清除本機匯入題庫，回到預設 sample 題庫。');
  };

  const loginGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUserLabel(cred.user.email ?? cred.user.uid);
      setResult('Google 登入成功，可同步 Firebase 題庫。');
    } catch {
      setResult('Google 登入失敗，請檢查 Firebase Auth 設定。');
    }
  };

  const logoutGoogle = async () => {
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin 題庫管理</h1>
      <div className="rounded border bg-white p-3 text-sm">
        <p>目前帳號：{userLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={loginGoogle}>Google 登入</button>
          <button className="rounded border px-3 py-1" onClick={logoutGoogle}>登出</button>
          <button className="rounded border px-3 py-1" onClick={pushCloud}>同步到 Firebase</button>
          <button className="rounded border px-3 py-1" onClick={pullCloud}>從 Firebase 拉取</button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 rounded border bg-white p-4">
        <textarea className="h-40 w-full rounded border p-2 font-mono text-xs" placeholder="貼上題庫 JSON（支援 full Question[] 或 simple-v1）" {...register('payload')} />
        {errors.payload && <p className="text-sm text-red-600">{errors.payload.message}</p>}
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">驗證並匯入</button>
          <button className="rounded border px-4 py-2" type="button" onClick={clearImported}>清除本機匯入題庫</button>
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
          {[...new Set(bank.map((x) => x.chapter))].map((x) => <option key={x}>{x}</option>)}
        </select>
        <select className="rounded border p-2" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="all">All domain</option>
          {[...new Set(bank.map((x) => x.domain))].map((x) => <option key={x}>{x}</option>)}
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
          {list.map((q) => <li key={q.id}>{q.id} | {q.chapter} | {q.domain} | {q.questionType} | {q.sourceType}</li>)}
        </ul>
      </div>
    </div>
  );
}
