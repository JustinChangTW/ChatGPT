import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export type SharedQuestionNote = {
  questionId: string;
  content: string;
  updatedAt: string;
};

export async function loadSharedQuestionNote(questionId: string): Promise<SharedQuestionNote | null> {
  if (!db || !questionId) return null;
  try {
    const snap = await getDoc(doc(db, 'sharedQuestionNotes', questionId));
    if (!snap.exists()) return null;
    const data = snap.data() as { content?: string; updatedAt?: { toDate?: () => Date } };
    return {
      questionId,
      content: typeof data.content === 'string' ? data.content : '',
      updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? ''
    };
  } catch {
    return null;
  }
}

export async function saveSharedQuestionNote(questionId: string, content: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!db) return { ok: false, reason: 'Firebase 尚未設定。' };
  if (!questionId) return { ok: false, reason: 'questionId 不可為空。' };
  try {
    await setDoc(
      doc(db, 'sharedQuestionNotes', questionId),
      {
        questionId,
        content,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : '儲存失敗' };
  }
}
