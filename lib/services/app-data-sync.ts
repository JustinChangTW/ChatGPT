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
import { loadAIParamsConfig, saveAIParamsConfig } from '@/lib/services/ai-params-config';

const SHARED_DOC = { collection: 'publicData', id: 'cctShared' } as const;
type SyncFailReason = 'firebase-not-configured' | 'unknown';

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export async function syncAllLocalDataToCloud(): Promise<{ ok: boolean; reason?: SyncFailReason | 'cloud-write-failed'; error?: string }> {
  if (!db) return { ok: false, reason: 'firebase-not-configured' };

  try {
    const appData = stripUndefined({
      questionBank: loadQuestionBank(),
      practiceAttempts: loadPracticeAttempts(),
      wrongNotebook: loadWrongNotebook(),
      chapterProgress: loadChapterProgress(),
      vocabularyBank: loadVocabularyBank(),
      dictionaryProviders: loadDictionaryProviders(),
      customKeywords: loadCustomKeywords(),
      aiParams: loadAIParamsConfig(),
      updatedAt: serverTimestamp(),
      version: 1
    });
    await setDoc(
      doc(db, SHARED_DOC.collection, SHARED_DOC.id),
      {
        appData
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
    aiParams: boolean;
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
    if (data.aiParams && typeof data.aiParams === 'object') saveAIParamsConfig(data.aiParams);

    return {
      ok: true,
      stats: {
        questionBank: Array.isArray(data.questionBank) ? data.questionBank.length : 0,
        practiceAttempts: Array.isArray(data.practiceAttempts) ? data.practiceAttempts.length : 0,
        wrongNotebook: Array.isArray(data.wrongNotebook) ? data.wrongNotebook.length : 0,
        chapterProgress: Array.isArray(data.chapterProgress) ? data.chapterProgress.length : 0,
        vocabularyBank: Array.isArray(data.vocabularyBank) ? data.vocabularyBank.length : 0,
        customKeywords: data.customKeywords && typeof data.customKeywords === 'object' ? Object.keys(data.customKeywords).length : 0,
        dictionaryProviders: Array.isArray(data.dictionaryProviders) ? data.dictionaryProviders.length : 0,
        aiParams: !!(data.aiParams && typeof data.aiParams === 'object')
      }
    };
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: 'cloud-read-failed', error };
  }
}
