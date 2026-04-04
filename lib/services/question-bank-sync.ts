import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '@/lib/firebase/client';
import { Question, questionImportSchema } from '@/lib/schemas/question';
import { loadQuestionBank, saveQuestionBank } from '@/lib/services/local-question-bank';

const SHARED_DOC = { collection: 'publicData', id: 'cctShared' } as const;

async function isAdminUser(): Promise<boolean> {
  if (!db || !auth?.currentUser) return false;
  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
  return snap.data()?.role === 'admin';
}

export async function syncLocalQuestionBankToCloud(): Promise<{
  ok: boolean;
  reason?: 'firebase-not-configured' | 'invalid-local-bank' | 'cloud-write-failed' | 'unknown';
  error?: string;
}> {
  if (!db) return { ok: false, reason: 'firebase-not-configured' };

  let safeBank: Question[] = [];
  try {
    const localBank = loadQuestionBank();
    safeBank = questionImportSchema.parse(localBank);
  } catch (err) {
    return { ok: false, reason: 'invalid-local-bank', error: err instanceof Error ? err.message : String(err) };
  }

  try {
    if (!(await isAdminUser())) {
      return { ok: false, reason: 'cloud-write-failed', error: '僅管理者可同步題庫到雲端。' };
    }
    await setDoc(doc(db, SHARED_DOC.collection, SHARED_DOC.id), { questionBank: safeBank, questionBankUpdatedAt: serverTimestamp(), questionBankVersion: 1 }, { merge: true });
    return { ok: true };
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: 'cloud-write-failed', error };
  }
}

export async function hydrateLocalQuestionBankFromCloud(): Promise<{
  ok: boolean;
  source?: 'cloud' | 'local';
  questions?: Question[];
  reason?: 'firebase-not-configured' | 'no-cloud-data' | 'invalid-cloud-data' | 'cloud-read-failed' | 'unknown';
  error?: string;
}> {
  if (!db) return { ok: false, source: 'local', reason: 'firebase-not-configured' };

  let data: Record<string, unknown> | undefined;
  try {
    const snap = await getDoc(doc(db, SHARED_DOC.collection, SHARED_DOC.id));
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
