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
import { loadKnowledgeBaseEntries, saveKnowledgeBaseEntries } from '@/lib/services/knowledge-base-storage';
import { ensureFirebaseUser } from '@/lib/services/firebase-session';

const SHARED_DOC = { collection: 'publicData', id: 'cctSharedCommon' } as const;
type SyncFailReason = 'firebase-not-configured' | 'unknown' | 'user-not-signed-in';

async function isAdminUser(uid: string): Promise<boolean> {
  if (!db) return false;
  const userSnap = await getDoc(doc(db, 'users', uid));
  return userSnap.data()?.role === 'admin';
}

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
    const session = await ensureFirebaseUser();
    if (!session.ok) return { ok: false, reason: 'user-not-signed-in', error: session.error };
    const isAdmin = await isAdminUser(session.uid);

    const commonData = stripUndefined({
      vocabularyBank: loadVocabularyBank(),
      customKeywords: loadCustomKeywords(),
      knowledgeBase: loadKnowledgeBaseEntries(),
      ...(isAdmin
        ? {
            questionBank: loadQuestionBank(),
            dictionaryProviders: loadDictionaryProviders(),
            aiParams: loadAIParamsConfig()
          }
        : {}),
      updatedAt: serverTimestamp()
    });
    const personalData = stripUndefined({
      practiceAttempts: loadPracticeAttempts(),
      wrongNotebook: loadWrongNotebook(),
      chapterProgress: loadChapterProgress(),
      updatedAt: serverTimestamp()
    });
    await setDoc(
      doc(db, SHARED_DOC.collection, SHARED_DOC.id),
      {
        commonData,
        version: 2,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    await setDoc(
      doc(db, 'users', session.uid),
      {
        personalData,
        personalVersion: 2,
        personalUpdatedAt: serverTimestamp()
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
    commonQuestionBank: number;
    commonVocabularyBank: number;
    commonCustomKeywords: number;
    commonDictionaryProviders: number;
    commonKnowledgeBase: number;
    commonAiParams: boolean;
    personalPracticeAttempts: number;
    personalWrongNotebook: number;
    personalChapterProgress: number;
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
    const session = await ensureFirebaseUser();
    if (!session.ok) return { ok: false, reason: 'user-not-signed-in', error: session.error };

    const [commonSnap, personalSnap] = await Promise.all([
      getDoc(doc(db, SHARED_DOC.collection, SHARED_DOC.id)),
      getDoc(doc(db, 'users', session.uid))
    ]);
    const isAdmin = await isAdminUser(session.uid);
    const commonData = commonSnap.data()?.commonData;
    const personalData = personalSnap.data()?.personalData;
    if (!commonData && !personalData) return { ok: false, reason: 'no-cloud-data' };

    if (isAdmin && Array.isArray(commonData?.questionBank)) saveQuestionBank(commonData.questionBank);
    if (Array.isArray(personalData?.practiceAttempts)) replacePracticeAttempts(personalData.practiceAttempts);
    if (Array.isArray(personalData?.wrongNotebook)) saveWrongNotebook(personalData.wrongNotebook);
    if (Array.isArray(personalData?.chapterProgress)) saveChapterProgress(personalData.chapterProgress);
    if (Array.isArray(commonData?.vocabularyBank)) {
      // keep write path centralized in existing service via direct localStorage entry
      window.localStorage.setItem('cct_vocabulary_bank_v1', JSON.stringify(commonData.vocabularyBank));
    }
    if (isAdmin && Array.isArray(commonData?.dictionaryProviders)) saveDictionaryProviders(commonData.dictionaryProviders);
    if (commonData?.customKeywords && typeof commonData.customKeywords === 'object') saveCustomKeywords(commonData.customKeywords);
    if (Array.isArray(commonData?.knowledgeBase)) saveKnowledgeBaseEntries(commonData.knowledgeBase);
    if (isAdmin && commonData?.aiParams && typeof commonData.aiParams === 'object') saveAIParamsConfig(commonData.aiParams);

    return {
      ok: true,
      stats: {
        commonQuestionBank: Array.isArray(commonData?.questionBank) ? commonData.questionBank.length : 0,
        commonVocabularyBank: Array.isArray(commonData?.vocabularyBank) ? commonData.vocabularyBank.length : 0,
        commonCustomKeywords:
          commonData?.customKeywords && typeof commonData.customKeywords === 'object' ? Object.keys(commonData.customKeywords).length : 0,
        commonDictionaryProviders: Array.isArray(commonData?.dictionaryProviders) ? commonData.dictionaryProviders.length : 0,
        commonKnowledgeBase: Array.isArray(commonData?.knowledgeBase) ? commonData.knowledgeBase.length : 0,
        commonAiParams: !!(commonData?.aiParams && typeof commonData.aiParams === 'object'),
        personalPracticeAttempts: Array.isArray(personalData?.practiceAttempts) ? personalData.practiceAttempts.length : 0,
        personalWrongNotebook: Array.isArray(personalData?.wrongNotebook) ? personalData.wrongNotebook.length : 0,
        personalChapterProgress: Array.isArray(personalData?.chapterProgress) ? personalData.chapterProgress.length : 0,
        questionBank: Array.isArray(commonData?.questionBank) ? commonData.questionBank.length : 0,
        practiceAttempts: Array.isArray(personalData?.practiceAttempts) ? personalData.practiceAttempts.length : 0,
        wrongNotebook: Array.isArray(personalData?.wrongNotebook) ? personalData.wrongNotebook.length : 0,
        chapterProgress: Array.isArray(personalData?.chapterProgress) ? personalData.chapterProgress.length : 0,
        vocabularyBank: Array.isArray(commonData?.vocabularyBank) ? commonData.vocabularyBank.length : 0,
        customKeywords:
          commonData?.customKeywords && typeof commonData.customKeywords === 'object' ? Object.keys(commonData.customKeywords).length : 0,
        dictionaryProviders: Array.isArray(commonData?.dictionaryProviders) ? commonData.dictionaryProviders.length : 0,
        aiParams: !!(commonData?.aiParams && typeof commonData.aiParams === 'object')
      }
    };
  } catch (err) {
    const error = err instanceof FirebaseError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: 'cloud-read-failed', error };
  }
}
