import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '@/lib/firebase/client';
import { loadQuestionBank, saveQuestionBank } from '@/lib/services/local-question-bank';
import { loadPracticeAttempts, replacePracticeAttempts } from '@/lib/services/practice-attempt-storage';
import { loadWrongNotebook, saveWrongNotebook } from '@/lib/services/wrong-notebook-storage';
import { loadChapterProgress, saveChapterProgress } from '@/lib/services/chapter-progress-storage';
import { loadVocabularyBank } from '@/lib/services/vocabulary-storage';
import { loadDictionaryProviders, saveDictionaryProviders } from '@/lib/services/dictionary-provider-config';
import { loadCustomKeywords, saveCustomKeywords } from '@/lib/services/custom-keyword-storage';

const SHARED_DOC = { collection: 'publicData', id: 'cctShared' } as const;
type SyncFailReason = 'firebase-not-configured' | 'unknown';

export async function syncAllLocalDataToCloud(): Promise<{ ok: boolean; reason?: SyncFailReason | 'cloud-write-failed'; error?: string }> {
  if (!db) return { ok: false, reason: 'firebase-not-configured' };

  try {
    await setDoc(
      doc(db, SHARED_DOC.collection, SHARED_DOC.id),
      {
        appData: {
          questionBank: loadQuestionBank(),
          practiceAttempts: loadPracticeAttempts(),
          wrongNotebook: loadWrongNotebook(),
          chapterProgress: loadChapterProgress(),
          vocabularyBank: loadVocabularyBank(),
          dictionaryProviders: loadDictionaryProviders(),
          customKeywords: loadCustomKeywords(),
          updatedAt: serverTimestamp(),
          version: 1
        }
      },
      { merge: true }
    );
    return { ok: true };
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: 'cloud-write-failed', error };
  }
}

export async function hydrateAllLocalDataFromCloud(): Promise<{
  ok: boolean;
  reason?: SyncFailReason | 'no-cloud-data' | 'cloud-read-failed';
  error?: string;
  stats?: {
    questionBank: number;
    practiceAttempts: number;
    wrongNotebook: number;
    chapterProgress: number;
    vocabularyBank: number;
    customKeywords: number;
    dictionaryProviders: number;
  };
}> {
  if (!db) return { ok: false, reason: 'firebase-not-configured' };

  try {
    const snap = await getDoc(doc(db, SHARED_DOC.collection, SHARED_DOC.id));
    const data = snap.data()?.appData;
    if (!data) return { ok: false, reason: 'no-cloud-data' };

    if (Array.isArray(data.questionBank)) saveQuestionBank(data.questionBank);
    if (Array.isArray(data.practiceAttempts)) replacePracticeAttempts(data.practiceAttempts);
    if (Array.isArray(data.wrongNotebook)) saveWrongNotebook(data.wrongNotebook);
    if (Array.isArray(data.chapterProgress)) saveChapterProgress(data.chapterProgress);
    if (Array.isArray(data.vocabularyBank)) {
      // keep write path centralized in existing service via direct localStorage entry
      window.localStorage.setItem('cct_vocabulary_bank_v1', JSON.stringify(data.vocabularyBank));
    }
    if (Array.isArray(data.dictionaryProviders)) saveDictionaryProviders(data.dictionaryProviders);
    if (data.customKeywords && typeof data.customKeywords === 'object') saveCustomKeywords(data.customKeywords);

    return {
      ok: true,
      stats: {
        questionBank: Array.isArray(data.questionBank) ? data.questionBank.length : 0,
        practiceAttempts: Array.isArray(data.practiceAttempts) ? data.practiceAttempts.length : 0,
        wrongNotebook: Array.isArray(data.wrongNotebook) ? data.wrongNotebook.length : 0,
        chapterProgress: Array.isArray(data.chapterProgress) ? data.chapterProgress.length : 0,
        vocabularyBank: Array.isArray(data.vocabularyBank) ? data.vocabularyBank.length : 0,
        customKeywords: data.customKeywords && typeof data.customKeywords === 'object' ? Object.keys(data.customKeywords).length : 0,
        dictionaryProviders: Array.isArray(data.dictionaryProviders) ? data.dictionaryProviders.length : 0
      }
    };
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: 'cloud-read-failed', error };
  }
}
