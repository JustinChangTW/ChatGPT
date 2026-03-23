import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '@/lib/firebase/client';
import { Question, questionImportSchema } from '@/lib/schemas/question';
import { loadQuestionBank, saveQuestionBank } from '@/lib/services/local-question-bank';
import { ensureFirebaseUser } from '@/lib/services/firebase-session';

export async function syncLocalQuestionBankToCloud(): Promise<{
  ok: boolean;
  reason?: 'firebase-not-configured' | 'auth-failed' | 'invalid-local-bank' | 'cloud-write-failed' | 'unknown';
  error?: string;
}> {
  if (!db) return { ok: false, reason: 'firebase-not-configured' };
  const session = await ensureFirebaseUser();
  if (!session.ok) return { ok: false, reason: session.reason, error: session.error };

  let safeBank: Question[] = [];
  try {
    const localBank = loadQuestionBank();
    safeBank = questionImportSchema.parse(localBank);
  } catch (err) {
    return { ok: false, reason: 'invalid-local-bank', error: err instanceof Error ? err.message : String(err) };
  }

  try {
    await setDoc(doc(db, 'users', session.uid), { questionBank: safeBank, questionBankUpdatedAt: serverTimestamp(), questionBankVersion: 1 }, { merge: true });
    return { ok: true, error: session.mode === 'anonymous' ? '使用匿名身份同步（同一瀏覽器可維持同 uid）' : undefined };
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: 'cloud-write-failed', error };
  }
}

export async function hydrateLocalQuestionBankFromCloud(): Promise<{
  ok: boolean;
  source?: 'cloud' | 'local';
  questions?: Question[];
  reason?: 'firebase-not-configured' | 'auth-failed' | 'no-cloud-data' | 'invalid-cloud-data' | 'cloud-read-failed' | 'unknown';
  error?: string;
}> {
  if (!db) return { ok: false, source: 'local', reason: 'firebase-not-configured' };
  const session = await ensureFirebaseUser();
  if (!session.ok) return { ok: false, source: 'local', reason: session.reason, error: session.error };

  let data: Record<string, unknown> | undefined;
  try {
    const snap = await getDoc(doc(db, 'users', session.uid));
    data = snap.data();
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, source: 'local', reason: 'cloud-read-failed', error };
  }

  if (!data?.questionBank) {
    return { ok: false, source: 'local', reason: 'no-cloud-data' };
  }

  try {
    const cloudBank = questionImportSchema.parse(data.questionBank);
    saveQuestionBank(cloudBank);
    return { ok: true, source: 'cloud', questions: cloudBank };
  } catch (err) {
    return {
      ok: false,
      source: 'local',
      reason: 'invalid-cloud-data',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
