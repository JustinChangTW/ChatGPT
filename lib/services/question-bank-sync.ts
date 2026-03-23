import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Question, questionImportSchema } from '@/lib/schemas/question';
import { loadQuestionBank, saveQuestionBank } from '@/lib/services/local-question-bank';
import { ensureFirebaseUser } from '@/lib/services/firebase-session';

export async function syncLocalQuestionBankToCloud(): Promise<{
  ok: boolean;
  reason?: 'firebase-not-configured' | 'auth-failed' | 'invalid-local-bank' | 'unknown';
}> {
  if (!db) return { ok: false, reason: 'firebase-not-configured' };
  const session = await ensureFirebaseUser();
  if (!session.ok) return { ok: false, reason: session.reason };

  try {
    const localBank = loadQuestionBank();
    const safeBank = questionImportSchema.parse(localBank);

    await setDoc(
      doc(db, 'users', session.uid),
      {
        questionBank: safeBank,
        questionBankUpdatedAt: serverTimestamp(),
        questionBankVersion: 1
      },
      { merge: true }
    );

    return { ok: true };
  } catch {
    return { ok: false, reason: 'invalid-local-bank' };
  }
}

export async function hydrateLocalQuestionBankFromCloud(): Promise<{
  ok: boolean;
  source?: 'cloud' | 'local';
  questions?: Question[];
  reason?: 'firebase-not-configured' | 'auth-failed' | 'no-cloud-data' | 'invalid-cloud-data' | 'unknown';
}> {
  if (!db) return { ok: false, source: 'local', reason: 'firebase-not-configured' };
  const session = await ensureFirebaseUser();
  if (!session.ok) return { ok: false, source: 'local', reason: session.reason };

  try {
    const snap = await getDoc(doc(db, 'users', session.uid));
    const data = snap.data();

    if (!data?.questionBank) {
      return { ok: false, source: 'local', reason: 'no-cloud-data' };
    }

    const cloudBank = questionImportSchema.parse(data.questionBank);
    saveQuestionBank(cloudBank);
    return { ok: true, source: 'cloud', questions: cloudBank };
  } catch {
    return { ok: false, source: 'local', reason: 'invalid-cloud-data' };
  }
}
