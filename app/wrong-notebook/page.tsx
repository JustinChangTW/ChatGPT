'use client';

import { useMemo, useState } from 'react';
import { sampleQuestions } from '@/lib/mocks/sample-questions';

type WrongRow = {
  questionId: string;
  wrongCount: number;
  chapter: string;
  domain: string;
  questionType: 'theory' | 'practical';
  mastered: boolean;
};

const rows: WrongRow[] = [
  { questionId: 'q-003', wrongCount: 4, chapter: '第3章', domain: 'Network Security Controls', questionType: 'practical', mastered: false },
  { questionId: 'q-001', wrongCount: 3, chapter: '第1章', domain: 'Information Security Threats and Attacks', questionType: 'theory', mastered: true }
];

function aiTutorReply(question: string, explanation: string, history: { role: 'user' | 'assistant'; text: string }[]): string {
  const latest = history[history.length - 1]?.text ?? '';
  return `AI 助教（示範）\n你問：「${latest}」\n\n重點：${question}\n建議理解方向：${explanation}\n\n追問建議：\n1) 這題考點和常見陷阱是什麼？\n2) 若換成實作題要怎麼判斷？\n3) 請用一步一步方式再解一次。`;
}

export default function WrongNotebookPage() {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [chat, setChat] = useState<Record<string, { role: 'user' | 'assistant'; text: string }[]>>({});

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        question: sampleQuestions.find((q) => q.id === r.questionId)
      })),
    []
  );

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

      <table className="w-full overflow-hidden rounded border bg-white text-sm">
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
              <td className="p-2">{r.questionType}</td>
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
                  <div className="mt-2 flex gap-2">
                    <input
                      className="w-full rounded border px-2 py-1"
                      placeholder="例如：為什麼我這題會錯？可追問細節。"
                      value={ask}
                      onChange={(e) => setAsk(e.target.value)}
                    />
                    <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => sendAsk(openedId, q.stem, q.explanation)}>
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
