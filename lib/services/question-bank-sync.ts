import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Question, questionImportSchema } from '@/lib/schemas/question';
import { loadQuestionBank, saveQuestionBank } from '@/lib/services/local-question-bank';

export async function syncLocalQuestionBankToCloud(): Promise<{
  ok: boolean;
  reason?: 'not-signed-in' | 'invalid-local-bank' | 'unknown';
}> {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'not-signed-in' };

  try {
    const localBank = loadQuestionBank();
    const safeBank = questionImportSchema.parse(localBank);

    await setDoc(
      doc(db, 'users', user.uid),
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
  reason?: 'not-signed-in' | 'no-cloud-data' | 'invalid-cloud-data' | 'unknown';
}> {
  const user = auth.currentUser;
  if (!user) return { ok: false, source: 'local', reason: 'not-signed-in' };

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
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
