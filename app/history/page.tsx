const records = [
  { id: 'a1', mode: 'chapter', score: 70, accuracy: 70, submittedAt: '2026-03-20T10:00:00.000Z' },
  { id: 'a2', mode: 'exam', score: 82, accuracy: 82, submittedAt: '2026-03-21T11:00:00.000Z' }
];

export default function HistoryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History / Analytics</h1>
      <ul className="space-y-2">
        {records.map((r) => (
          <li key={r.id} className="rounded border bg-white p-3">{r.submittedAt} · {r.mode} · score {r.score} · accuracy {r.accuracy}%</li>
        ))}
      </ul>
    </div>
  );
}
