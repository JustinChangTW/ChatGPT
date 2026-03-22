import { Card } from '@/components/ui/card';
import { DomainPerformanceChart } from '@/components/charts/domain-performance-chart';

const mockStats = {
  todayAttempts: 2,
  totalAnswered: 140,
  avgAccuracy: 78.5,
  wrongCount: 36,
  latestScore: 82
};

const mockDomains = [
  { domain: 'Threats', accuracy: 72 },
  { domain: 'Network', accuracy: 80 },
  { domain: 'Controls', accuracy: 76 },
  { domain: 'AppSec/Cloud', accuracy: 70 },
  { domain: 'Wireless', accuracy: 85 },
  { domain: 'Data', accuracy: 74 },
  { domain: 'Monitoring', accuracy: 79 },
  { domain: 'Incident/Risk', accuracy: 81 }
];

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="今日練習次數">{mockStats.todayAttempts}</Card>
        <Card title="總答題數">{mockStats.totalAnswered}</Card>
        <Card title="平均正確率">{mockStats.avgAccuracy}%</Card>
        <Card title="錯題數量">{mockStats.wrongCount}</Card>
        <Card title="最近一次成績">{mockStats.latestScore}</Card>
      </div>
      <Card title="各領域表現">
        <DomainPerformanceChart data={mockDomains} />
      </Card>
    </div>
  );
}
