'use client';

import { useMemo, useState } from 'react';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { CCT_KNOWLEDGE_BASE, matchKnowledgeByQuestion, searchKnowledgeItems } from '@/lib/knowledge/cct-knowledge-base';

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<number | 'all'>('all');
  const questionBank = useMemo(() => loadQuestionBank(), []);

  const knowledgeItems = useMemo(
    () =>
      searchKnowledgeItems({
        query,
        chapterNo: chapterFilter
      }),
    [query, chapterFilter]
  );

  const questionMappedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    questionBank.forEach((q) => {
      const mapped = matchKnowledgeByQuestion(q);
      mapped.forEach((item) => counts.set(item.id, (counts.get(item.id) ?? 0) + 1));
    });
    return counts;
  }, [questionBank]);

  const chapters = useMemo(() => Array.from(new Set(CCT_KNOWLEDGE_BASE.map((x) => x.chapterNo))).sort((a, b) => a - b), []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">C|CT 知識庫（依章節）</h1>
      <p className="text-sm text-slate-600">
        已建立 {CCT_KNOWLEDGE_BASE.length} 筆知識點（對應 161 題配置），可依章節與關鍵字搜尋，並顯示每個知識點目前可對應到的題庫題數（用 tags/keywords 比對）。
      </p>

      <div className="grid gap-2 rounded border bg-white p-3 text-sm md:grid-cols-3">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-500">搜尋（主題 / 關鍵字 / 考點）</span>
          <input
            className="w-full rounded border px-2 py-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：phishing, SIEM, incident-response"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">章節</span>
          <select
            className="w-full rounded border px-2 py-1"
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">全部章節</option>
            {chapters.map((chapterNo) => (
              <option key={chapterNo} value={chapterNo}>
                Chapter {chapterNo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {knowledgeItems.length === 0 && <p className="text-sm text-slate-500">查無符合項目。</p>}
        {knowledgeItems.map((item) => (
          <article key={item.id} className="rounded border bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-white">Chapter {item.chapterNo}</span>
              <h2 className="text-lg font-semibold">{item.title}</h2>
            </div>
            <p className="text-sm text-slate-500">{item.chapterTitle}</p>
            <p className="mt-2 text-sm">{item.summary}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">重點</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {item.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">考題訊號</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {item.examSignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">對應題數：{questionMappedCounts.get(item.id) ?? 0}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
