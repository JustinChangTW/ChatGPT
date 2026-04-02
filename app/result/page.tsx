import { sampleQuestions } from '@/lib/mocks/sample-questions';

export default function ResultPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Result</h1>
      <div className="rounded border bg-white p-4">
        <p>總分：80 / 100</p>
        <p>答對率：80%</p>
      </div>
      <ul className="space-y-3">
        {sampleQuestions.slice(0, 3).map((q) => (
          <li key={q.id} className="rounded border bg-white p-4">
            <p className="font-semibold">{q.stem}</p>
            <p className="text-sm text-slate-500">詳解：{q.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
