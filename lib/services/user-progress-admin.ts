import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { PracticeAttempt } from '@/lib/schemas/practice';

export type UserProgressSummary = {
  uid: string;
  role: string;
  attempts: number;
  avgScore: number;
  lastSubmittedAt: string;
};

export async function loadAllUserProgressSummaries(): Promise<{ ok: true; rows: UserProgressSummary[] } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: 'Firebase 尚未設定。' };
  try {
    const snap = await getDocs(collection(db, 'users'));
    const rows: UserProgressSummary[] = snap.docs.map((d) => {
      const data = d.data() as {
        role?: string;
        practiceAttempts?: PracticeAttempt[];
      };
      const attempts = Array.isArray(data.practiceAttempts) ? data.practiceAttempts : [];
      const avgScore = attempts.length > 0 ? Number((attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length).toFixed(1)) : 0;
      const lastSubmittedAt = attempts[0]?.submittedAt ?? '-';
      return {
        uid: d.id,
        role: data.role ?? 'member',
        attempts: attempts.length,
        avgScore,
        lastSubmittedAt
      };
    });
    rows.sort((a, b) => b.attempts - a.attempts);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '載入失敗' };
  }
}
