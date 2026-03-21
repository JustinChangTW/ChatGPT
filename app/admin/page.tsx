'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { validateQuestionImport } from '@/lib/services/question-import-service';

const importSchema = z.object({
  payload: z.string().min(2, '請貼上 JSON')
});

type ImportForm = z.infer<typeof importSchema>;

export default function AdminPage() {
  const [result, setResult] = useState<string>('');
  const [domain, setDomain] = useState<string>('all');
  const [chapter, setChapter] = useState<string>('all');
  const [type, setType] = useState<string>('all');

  const { register, handleSubmit, formState: { errors } } = useForm<ImportForm>({
    resolver: zodResolver(importSchema)
  });

  const onSubmit = (values: ImportForm) => {
    try {
      const parsed = JSON.parse(values.payload);
      const validated = validateQuestionImport(parsed);
      setResult(validated.ok ? `匯入成功，共 ${validated.questions.length} 題` : `匯入失敗：${validated.errors.join('; ')}`);
    } catch {
      setResult('JSON 格式錯誤');
    }
  };

  const list = useMemo(() => sampleQuestions.filter((q) =>
    (domain === 'all' || q.domain === domain) &&
    (chapter === 'all' || q.chapter === chapter) &&
    (type === 'all' || q.questionType === type)
  ), [domain, chapter, type]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin 題庫管理</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 rounded border bg-white p-4">
        <textarea className="h-40 w-full rounded border p-2 font-mono text-xs" placeholder="貼上題庫 JSON" {...register('payload')} />
        {errors.payload && <p className="text-sm text-red-600">{errors.payload.message}</p>}
        <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">驗證並匯入</button>
        {result && <p className="text-sm">{result}</p>}
      </form>

      <div className="grid gap-2 md:grid-cols-3">
        <select className="rounded border p-2" value={chapter} onChange={(e) => setChapter(e.target.value)}>
          <option value="all">All chapter</option>
          {[...new Set(sampleQuestions.map((x) => x.chapter))].map((x) => <option key={x}>{x}</option>)}
        </select>
        <select className="rounded border p-2" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="all">All domain</option>
          {[...new Set(sampleQuestions.map((x) => x.domain))].map((x) => <option key={x}>{x}</option>)}
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
