'use client';

import { useMemo, useState } from 'react';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { loadWrongNotebook } from '@/lib/services/wrong-notebook-storage';

function aiTutorReply(question: string, explanation: string, history: { role: 'user' | 'assistant'; text: string }[]): string {
  const latest = history[history.length - 1]?.text ?? '';
  return `AI 助教（示範）\n你問：「${latest}」\n\n重點：${question}\n建議理解方向：${explanation}\n\n追問建議：\n1) 這題考點和常見陷阱是什麼？\n2) 若換成實作題要怎麼判斷？\n3) 請用一步一步方式再解一次。`;
}

export default function WrongNotebookPage() {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [chat, setChat] = useState<Record<string, { role: 'user' | 'assistant'; text: string }[]>>({});
  const [wrongRows] = useState(() => loadWrongNotebook());

  const questionPool = useMemo(() => {
    const local = loadQuestionBank();
    const map = new Map([...sampleQuestions, ...local].map((q) => [q.id, q]));
    return map;
  }, []);

  const enriched = useMemo(() => wrongRows.map((r) => {
    const question = questionPool.get(r.questionId);
    return {
      ...r,
      chapter: question?.chapter ?? '-',
      domain: question?.domain ?? '-',
      questionType: question?.questionType ?? 'theory',
      question
    };
  }), [wrongRows, questionPool]);

  const sendAsk = (questionId: string, stem: string, explanation: string) => {
    const userText = ask.trim();
    if (!userText) return;
    const nextHistory = [...(chat[questionId] ?? []), { role: 'user' as const, text: userText }];
    const reply = aiTutorReply(stem, explanation, nextHistory);
    setChat((s) => ({ ...s, [questionId]: [...nextHistory, { role: 'assistant', text: reply }] }));
    setAsk('');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Wrong Answer Notebook</h1>
      <p className="text-sm text-slate-500">
        可展開題目內容、查看詳解，並與 AI 助教互動追問。
      </p>
      {enriched.length === 0 ? <p className="rounded border bg-white p-3 text-sm">目前沒有錯題紀錄。先去章節練習作答後，這裡會自動累積。</p> : null}

      <div className="space-y-2 md:hidden">
        {enriched.map((r) => (
          <div key={`mobile-${r.questionId}`} className="rounded border bg-white p-3 text-sm">
            <p className="font-semibold break-all">{r.questionId}</p>
            <p className="mt-1 text-slate-600">錯誤次數：{r.wrongCount}</p>
            <p className="text-slate-600">章節：{r.chapter}</p>
            <p className="text-slate-600">領域：{r.domain}</p>
            <p className="text-slate-600">題型：{r.questionType ?? '-'}</p>
            <p className="text-slate-600">已掌握：{String(r.mastered)}</p>
            <button className="mt-2 w-full rounded border px-2 py-2" onClick={() => setOpenedId((x) => (x === r.questionId ? null : r.questionId))}>
              {openedId === r.questionId ? '收合' : '開啟'}
            </button>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded border bg-white md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">Question</th>
              <th className="p-2">Wrong</th>
              <th className="p-2">Chapter</th>
              <th className="p-2">Domain</th>
              <th className="p-2">Type</th>
              <th className="p-2">Mastered</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((r) => (
              <tr key={r.questionId} className="border-t">
                <td className="p-2">{r.questionId}</td>
                <td className="p-2">{r.wrongCount}</td>
                <td className="p-2">{r.chapter}</td>
                <td className="p-2">{r.domain}</td>
                <td className="p-2">{r.questionType ?? '-'}</td>
                <td className="p-2">{String(r.mastered)}</td>
                <td className="p-2">
                  <button className="rounded border px-2 py-1" onClick={() => setOpenedId((x) => (x === r.questionId ? null : r.questionId))}>
                    {openedId === r.questionId ? '收合' : '開啟'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openedId && (
        <div className="rounded-lg border bg-white p-4">
          {(() => {
            const row = enriched.find((x) => x.questionId === openedId);
            if (!row?.question) return <p>找不到題目內容。</p>;
            const q = row.question;
            const history = chat[openedId] ?? [];
            return (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">{q.stem}</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {q.options.map((o) => (
                    <li key={o.key}>
                      {o.key}. {o.text}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-600">
                  正確答案：{Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                </p>
                <p className="text-sm">詳解：{q.explanation}</p>

                <div className="rounded border bg-slate-50 p-3">
                  <p className="mb-2 font-semibold">AI 助教互動（可追問）</p>
                  <div className="max-h-56 space-y-2 overflow-auto rounded border bg-white p-2 text-sm">
                    {history.length === 0 ? <p className="text-slate-500">尚未提問，輸入問題開始互動。</p> : null}
                    {history.map((m, idx) => (
                      <p key={idx} className={m.role === 'user' ? 'text-blue-700' : 'text-slate-700'}>
                        <span className="font-semibold">{m.role === 'user' ? '你：' : 'AI：'}</span> {m.text}
                      </p>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-2 sm:flex">
                    <input
                      className="w-full rounded border px-2 py-1"
                      placeholder="例如：為什麼我這題會錯？可追問細節。"
                      value={ask}
                      onChange={(e) => setAsk(e.target.value)}
                    />
                    <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={() => sendAsk(openedId, q.stem, q.explanation)}>
                      詢問
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
