'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { DomainPerformanceChart } from '@/components/charts/domain-performance-chart';
import { loadPracticeAttempts } from '@/lib/services/practice-attempt-storage';
import { loadWrongNotebook } from '@/lib/services/wrong-notebook-storage';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { loadKnowledgeBaseEntries } from '@/lib/services/knowledge-base-storage';
import { loadVocabularyBank } from '@/lib/services/vocabulary-storage';

export default function DashboardPage() {
  const attempts = useMemo(() => loadPracticeAttempts(), []);
  const wrongRows = useMemo(() => loadWrongNotebook(), []);
  const questionBank = useMemo(() => loadQuestionBank(), []);
  const knowledgeBase = useMemo(() => loadKnowledgeBaseEntries(), []);
  const vocabularyBank = useMemo(() => loadVocabularyBank(), []);

  const stats = useMemo(() => {
    if (attempts.length === 0) {
      return {
        todayAttempts: 0,
        totalAnswered: 0,
        avgAccuracy: 0,
        wrongCount: wrongRows.reduce((acc, r) => acc + r.wrongCount, 0),
        latestScore: 0
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    const todayAttempts = attempts.filter((a) => a.submittedAt.slice(0, 10) === today).length;
    const totalAnswered = attempts.reduce((acc, a) => acc + a.totalQuestions, 0);
    const avgAccuracy = Number((attempts.reduce((acc, a) => acc + a.accuracy, 0) / attempts.length).toFixed(2));
    const latestScore = attempts[0]?.score ?? 0;
    return {
      todayAttempts,
      totalAnswered,
      avgAccuracy,
      wrongCount: wrongRows.reduce((acc, r) => acc + r.wrongCount, 0),
      latestScore
    };
  }, [attempts, wrongRows]);

  const domainData = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    attempts.forEach((a) => {
      Object.entries(a.domainBreakdown).forEach(([domain, d]) => {
        const base = m.get(domain) ?? { total: 0, correct: 0 };
        base.total += d.total;
        base.correct += d.correct;
        m.set(domain, base);
      });
    });
    return Array.from(m.entries()).map(([domain, d]) => ({
      domain,
      accuracy: d.total > 0 ? Number(((d.correct / d.total) * 100).toFixed(2)) : 0
    }));
  }, [attempts]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="今日練習次數">{stats.todayAttempts}</Card>
        <Card title="總答題數">{stats.totalAnswered}</Card>
        <Card title="平均正確率">{stats.avgAccuracy}%</Card>
        <Card title="累計錯題次數">{stats.wrongCount}</Card>
        <Card title="最近一次成績">{stats.latestScore}</Card>
        <Card title="目前題庫數">{questionBank.length}</Card>
        <Card title="知識庫條目數">{knowledgeBase.length}</Card>
        <Card title="單字庫條目數">{vocabularyBank.length}</Card>
      </div>
      <Card title="各領域表現">
        {domainData.length > 0 ? <DomainPerformanceChart data={domainData} /> : <p className="text-sm text-slate-500">尚無作答紀錄。</p>}
      </Card>
    </div>
  );
}
