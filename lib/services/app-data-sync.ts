import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { loadQuestionBank, saveQuestionBank } from '@/lib/services/local-question-bank';
import { loadPracticeAttempts, replacePracticeAttempts } from '@/lib/services/practice-attempt-storage';
import { loadWrongNotebook, saveWrongNotebook } from '@/lib/services/wrong-notebook-storage';
import { loadChapterProgress, saveChapterProgress } from '@/lib/services/chapter-progress-storage';

type SyncFailReason = 'firebase-not-configured' | 'not-signed-in' | 'unknown';

export async function syncAllLocalDataToCloud(): Promise<{ ok: boolean; reason?: SyncFailReason }> {
  if (!auth || !db) return { ok: false, reason: 'firebase-not-configured' };
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'not-signed-in' };

  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        appData: {
          questionBank: loadQuestionBank(),
          practiceAttempts: loadPracticeAttempts(),
          wrongNotebook: loadWrongNotebook(),
          chapterProgress: loadChapterProgress(),
          updatedAt: serverTimestamp(),
          version: 1
        }
      },
      { merge: true }
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export async function hydrateAllLocalDataFromCloud(): Promise<{
  ok: boolean;
  reason?: SyncFailReason | 'no-cloud-data';
  stats?: { questionBank: number; practiceAttempts: number; wrongNotebook: number; chapterProgress: number };
}> {
  if (!auth || !db) return { ok: false, reason: 'firebase-not-configured' };
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'not-signed-in' };

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.data()?.appData;
    if (!data) return { ok: false, reason: 'no-cloud-data' };

    if (Array.isArray(data.questionBank)) saveQuestionBank(data.questionBank);
    if (Array.isArray(data.practiceAttempts)) replacePracticeAttempts(data.practiceAttempts);
    if (Array.isArray(data.wrongNotebook)) saveWrongNotebook(data.wrongNotebook);
    if (Array.isArray(data.chapterProgress)) saveChapterProgress(data.chapterProgress);

    return {
      ok: true,
      stats: {
        questionBank: Array.isArray(data.questionBank) ? data.questionBank.length : 0,
        practiceAttempts: Array.isArray(data.practiceAttempts) ? data.practiceAttempts.length : 0,
        wrongNotebook: Array.isArray(data.wrongNotebook) ? data.wrongNotebook.length : 0,
        chapterProgress: Array.isArray(data.chapterProgress) ? data.chapterProgress.length : 0
      }
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

