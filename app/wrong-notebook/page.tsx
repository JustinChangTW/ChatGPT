const rows = [
  { questionId: 'q-003', wrongCount: 4, chapter: 'Chapter 3', domain: 'Network Security Controls', questionType: 'practical', mastered: false },
  { questionId: 'q-001', wrongCount: 3, chapter: 'Chapter 1', domain: 'Threats', questionType: 'theory', mastered: true }
];

export default function WrongNotebookPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Wrong Answer Notebook</h1>
      <table className="w-full overflow-hidden rounded border bg-white text-sm">
        <thead className="bg-slate-100 text-left">
          <tr><th className="p-2">Question</th><th className="p-2">Wrong</th><th className="p-2">Chapter</th><th className="p-2">Domain</th><th className="p-2">Type</th><th className="p-2">Mastered</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.questionId} className="border-t"><td className="p-2">{r.questionId}</td><td className="p-2">{r.wrongCount}</td><td className="p-2">{r.chapter}</td><td className="p-2">{r.domain}</td><td className="p-2">{r.questionType}</td><td className="p-2">{String(r.mastered)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
