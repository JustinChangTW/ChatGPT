'use client';

import { usePracticeStore } from '@/lib/store/use-practice-store';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { assembleOfficialExam } from '@/lib/services/exam-assembly';

export default function ExamPage() {
  const { setSession, questions } = usePracticeStore();

  const startExam = async () => {
    const assembled = await assembleOfficialExam(sampleQuestions);
    setSession({ sessionId: `exam-${Date.now()}`, questions: assembled });
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">正式模擬考</h1>
      <p>固定 60 題（理論 50 + 實作 10），依 C|CT 藍圖近似配題，題庫不足自動補生成題。</p>
      <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={startExam}>開始 60 題模擬考</button>
      {questions.length > 0 && <p>已組卷完成，共 {questions.length} 題。</p>}
    </div>
  );
}
