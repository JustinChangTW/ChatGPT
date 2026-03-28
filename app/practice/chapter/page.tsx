'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePracticeStore } from '@/lib/store/use-practice-store';
import { Question } from '@/lib/schemas/question';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { assembleChapterPractice } from '@/lib/services/exam-assembly';
import { loadChapterProgress, updateChapterProgress } from '@/lib/services/chapter-progress-storage';
import { recordWrongNotebook } from '@/lib/services/wrong-notebook-storage';
import { buildPracticeAttempt } from '@/lib/services/practice-attempt-service';
import { savePracticeAttempt } from '@/lib/services/practice-attempt-storage';
import { DictionaryEntry, getBuiltinDictionaryTerms, lookupDictionaryTerm } from '@/lib/services/inline-dictionary';
import { addVocabularyEntry, findVocabularyEntry } from '@/lib/services/vocabulary-storage';
import { fetchRealtimeTranslation } from '@/lib/services/realtime-translation';

const fallbackChapters = ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Chapter 6', 'Chapter 7', 'Chapter 8'];

export default function ChapterPracticePage() {
  const [bank, setBank] = useState<Question[]>(sampleQuestions);
  const [progress, setProgress] = useState(loadChapterProgress());
  const [submitted, setSubmitted] = useState(false);
  const chapters = useMemo(() => {
    const set = new Set(bank.map((q) => q.chapter));
    return set.size > 0 ? Array.from(set) : fallbackChapters;
  }, [bank]);

  const [selectedChapter, setSelectedChapter] = useState(fallbackChapters[0]);
  const [selectedWord, setSelectedWord] = useState<{
    term: string;
    translation: string;
    definition: string;
    phonetic?: string;
    audioUrl?: string;
    sourceQuestionId?: string;
  } | null>(null);
  const [wordHint, setWordHint] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [inlineKeywordMode, setInlineKeywordMode] = useState(false);
  const [customKeywordsByQuestion, setCustomKeywordsByQuestion] = useState<Record<string, DictionaryEntry[]>>({});
  const questionPanelRef = useRef<HTMLDivElement | null>(null);
  // Keep a single destructure to avoid accidental duplicate declarations during merge edits.
  const { questions, currentIndex, answers, setSession, setAnswer, setCurrentIndex, next, prev, reset } = usePracticeStore();

  useEffect(() => {
    const loaded = loadQuestionBank();
    setBank(loaded);
    if (loaded[0]?.chapter) setSelectedChapter(loaded[0].chapter);
    setProgress(loadChapterProgress());
  }, []);

  const current = questions[currentIndex];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length,
    [questions, answers]
  );

  const result = useMemo(() => {
    if (questions.length === 0) return null;
    const detail = questions.map((q) => {
      const userAnswer = answers[q.id];
      const correct = Array.isArray(q.correctAnswer)
        ? Array.isArray(userAnswer) &&
          q.correctAnswer.length === userAnswer.length &&
          q.correctAnswer.every((x) => userAnswer.includes(x))
        : userAnswer === q.correctAnswer;
      return { question: q, userAnswer, correct };
    });
    const correctCount = detail.filter((x) => x.correct).length;
    const score = Math.round((correctCount / questions.length) * 100);
    return { detail, correctCount, score };
  }, [questions, answers]);

  const suggestedEntries = useMemo(() => {
    if (!current) return [];
    const dictionaryTerms = new Set(getBuiltinDictionaryTerms());
    const text = [current.stem, ...current.options.map((x) => x.text)].join(' ');
    const tokens = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
    const terms = Array.from(
      new Set(
        tokens
          .map((token) => token.toLowerCase())
          .filter((token) => dictionaryTerms.has(token))
      )
    );
    return terms
      .map((term) => lookupDictionaryTerm(term))
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  }, [current]);

  const startPractice = async () => {
    const qs = await assembleChapterPractice(bank, selectedChapter);
    setSession({ sessionId: `chapter-${Date.now()}`, questions: qs });
    setSubmitted(false);
  };

  const submitPractice = () => {
    if (!result) return;
    const nowISO = new Date().toISOString();
    const questionResults = result.detail
      .filter((item) => item.userAnswer !== undefined)
      .map((item) => ({
        questionId: item.question.id,
        sourceType: item.question.sourceType,
        userAnswer: item.userAnswer as string | string[],
        correctAnswer: item.question.correctAnswer,
        isCorrect: item.correct,
        chapter: item.question.chapter,
        domain: item.question.domain,
        questionType: item.question.questionType
      }));
    result.detail.forEach((item) => {
      if (item.userAnswer === undefined) return;
      recordWrongNotebook({
        userId: 'local-user',
        questionId: item.question.id,
        isCorrect: item.correct,
        selectedAnswer: Array.isArray(item.userAnswer) ? item.userAnswer : String(item.userAnswer),
        nowISO
      });
    });
    if (questionResults.length > 0) {
      const attempt = buildPracticeAttempt({
        id: `attempt-${Date.now()}`,
        userId: 'local-user',
        mode: 'chapter',
        selectedChapter,
        questionResults,
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        submittedAt: nowISO
      });
      savePracticeAttempt(attempt);
    }
    setSubmitted(true);
    updateChapterProgress({
      chapter: selectedChapter,
      totalQuestions: questions.length,
      score: result.score,
      completed: answeredCount >= questions.length
    });
    setProgress(loadChapterProgress());
  };

  const restartPractice = async () => {
    reset();
    setSubmitted(false);
    await startPractice();
  };

  const openWordCard = async (term: string, sourceQuestionId?: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    const vocabHit = findVocabularyEntry(cleanTerm);
    if (vocabHit) {
      setSelectedWord({ ...vocabHit, sourceQuestionId });
      return;
    }
    const found = lookupDictionaryTerm(cleanTerm);
    if (found) {
      setSelectedWord({ ...found, sourceQuestionId });
      return;
    }
    setIsTranslating(true);
    const realtime = await fetchRealtimeTranslation(cleanTerm);
    setIsTranslating(false);
    if (realtime) {
      setSelectedWord({ ...realtime, sourceQuestionId });
      return;
    }
    setSelectedWord({
      term: cleanTerm,
      translation: '（暫無內建翻譯）',
      definition: '可先加入字庫，後續再補充解釋。若要即時翻譯，請確認網路可連線。',
      sourceQuestionId
    });
  };

  const saveWord = () => {
    if (!selectedWord) return;
    addVocabularyEntry(selectedWord);
    setWordHint(`已加入字庫：${selectedWord.term}`);
  };

  const translateSelectedText = async (sourceQuestionId?: string, addAsKeyword = false) => {
    const selected = window.getSelection()?.toString().trim() ?? '';
    const normalized = selected.replace(/\s+/g, ' ');
    if (!normalized) {
      setWordHint('請先反白想查的英文單字或片語。');
      return;
    }
    await openWordCard(normalized, sourceQuestionId);
    if (addAsKeyword && sourceQuestionId) {
      const found = lookupDictionaryTerm(normalized) ?? (await fetchRealtimeTranslation(normalized));
      const entry: DictionaryEntry =
        found ?? { term: normalized, translation: '（暫無翻譯）', definition: '可先加入字庫，後續補充。' };
      setCustomKeywordsByQuestion((prev) => {
        const exists = (prev[sourceQuestionId] ?? []).some((x) => x.term.toLowerCase() === normalized.toLowerCase());
        if (exists) return prev;
        return {
          ...prev,
          [sourceQuestionId]: [...(prev[sourceQuestionId] ?? []), entry]
        };
      });
      setWordHint(`已翻譯並加入關鍵字：${normalized}`);
      return;
    }
    setWordHint('');
  };

  const addAllSuggestedTerms = () => {
    if (!current || activeKeywordEntries.length === 0) return;
    activeKeywordEntries.forEach((entry) => {
      addVocabularyEntry({ ...entry, sourceQuestionId: current.id });
    });
    setWordHint(`已加入 ${activeKeywordEntries.length} 個關鍵字到字庫`);
  };

  const activeKeywordEntries = useMemo(() => {
    if (!current) return suggestedEntries;
    const custom = customKeywordsByQuestion[current.id] ?? [];
    const map = new Map<string, DictionaryEntry>();
    [...suggestedEntries, ...custom].forEach((entry) => map.set(entry.term.toLowerCase(), entry));
    return Array.from(map.values());
  }, [current, customKeywordsByQuestion, suggestedEntries]);

  const speakTerm = (term: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(term);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);
  };

  const renderKeywordMixedText = (text: string): ReactNode => {
    if (!inlineKeywordMode || activeKeywordEntries.length === 0) return text;
    const terms = activeKeywordEntries
      .map((entry) => entry.term)
      .filter((x) => x.trim())
      .sort((a, b) => b.length - a.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (terms.length === 0) return text;
    const pattern = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
    const fragments: ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) {
        fragments.push(text.slice(last, match.index));
      }
      const original = match[0];
      const mapped = activeKeywordEntries.find((x) => x.term.toLowerCase() === original.toLowerCase());
      fragments.push(
        <span key={`${match.index}-${original}`} className="rounded bg-amber-100 px-1 font-semibold text-amber-800">
          {mapped?.translation ?? original}
        </span>
      );
      last = pattern.lastIndex;
    }
    if (last < text.length) fragments.push(text.slice(last));
    return fragments;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chapter Practice</h1>
      <p className="text-sm text-slate-500">目前本機題庫：{bank.length} 題（含 Admin 匯入）</p>
      <div className="grid gap-2 sm:flex">
        <select className="w-full rounded border px-3 py-3 sm:w-auto" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)}>
          {chapters.map((ch) => <option key={ch}>{ch}</option>)}
        </select>
        <button className="rounded bg-blue-600 px-4 py-3 text-white" onClick={startPractice}>開始 10 題練習</button>
      </div>
      <div className="rounded border bg-white p-4">
        <p className="mb-2 text-sm font-semibold">章節進度追蹤</p>
        <ul className="space-y-1 text-sm">
          {chapters.map((ch) => {
            const p = progress.find((x) => x.chapter === ch);
            const doneRate = p ? Math.round((p.completed / Math.max(p.attempts, 1)) * 100) : 0;
            return (
              <li key={ch} className="flex flex-col gap-1 border-b pb-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <span>{ch}</span>
                <span className="text-slate-600">
                  {p ? `完成 ${p.completed}/${p.attempts} 次 · 最近 ${p.lastScore} 分 · 完成率 ${doneRate}%` : '尚未作答'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {current && !submitted ? (
        <div ref={questionPanelRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm text-slate-500">第 {currentIndex + 1}/{questions.length} 題 · {current.sourceType === 'generated' ? '系統生成題' : '原始題庫'}</p>
          <h2 className="mb-2 whitespace-pre-line text-lg font-semibold leading-8">{renderKeywordMixedText(current.stem)}</h2>
          <p className="mb-3 text-xs text-slate-500">可直接反白英文單字/片語後，點「翻譯選取文字」。</p>
          <div className="mb-3">
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
              onClick={() => setInlineKeywordMode((v) => !v)}
            >
              {inlineKeywordMode ? '切回原文顯示' : '關鍵字中英混合顯示'}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              目前模式：{inlineKeywordMode ? '中英混合（關鍵字以中文呈現）' : '原文英文'}
            </p>
          </div>
          {(activeKeywordEntries.length > 0 || current) && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">建議關鍵字：</p>
                <button
                  type="button"
                  className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
                  onClick={addAllSuggestedTerms}
                >
                  全部加入字庫
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {activeKeywordEntries.map((entry) => (
                  <button
                    key={entry.term}
                    type="button"
                    className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
                    onClick={() => {
                      void openWordCard(entry.term, current.id);
                      setWordHint('');
                    }}
                  >
                    {entry.term} · {entry.translation}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => void translateSelectedText(current.id, true)}
                >
                  翻譯選取文字並加入關鍵字
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="mb-4 rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
            onClick={() => void translateSelectedText(current.id)}
          >
            翻譯選取文字
          </button>
          {isTranslating && <p className="mb-3 text-xs text-slate-500">翻譯中…</p>}
          {selectedWord && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-semibold">
                {selectedWord.term} → {selectedWord.translation}
              </p>
              {selectedWord.phonetic && <p className="mt-1 text-xs text-slate-600">發音：{selectedWord.phonetic}</p>}
              {selectedWord.audioUrl && (
                <audio className="mt-1 w-full max-w-xs" controls src={selectedWord.audioUrl}>
                  您的瀏覽器不支援 audio 播放。
                </audio>
              )}
              {!selectedWord.audioUrl && (
                <button
                  type="button"
                  className="mt-1 rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => speakTerm(selectedWord.term)}
                >
                  播放發音（瀏覽器語音）
                </button>
              )}
              <p className="mt-1 text-slate-700">{selectedWord.definition}</p>
              <button type="button" className="mt-2 rounded border border-amber-400 bg-white px-2 py-1 text-xs" onClick={saveWord}>
                加入單字庫
              </button>
              {wordHint && <p className="mt-1 text-xs text-emerald-700">{wordHint}</p>}
            </div>
          )}
          <div className="space-y-2">
            {current.options.map((opt) => (
              <label
                className={`block rounded-lg border p-3 transition ${
                  answers[current.id] === opt.key ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-400 hover:bg-blue-50'
                }`}
                key={opt.key}
              >
                <input type="radio" className="mr-2" name={current.id} checked={answers[current.id] === opt.key} onChange={() => setAnswer(current.id, opt.key)} />
                <span className="font-medium">{opt.key}.</span>{' '}
                <span className="whitespace-pre-line leading-7">{renderKeywordMixedText(opt.text)}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <button className="rounded border px-3 py-2" onClick={prev}>上一題</button>
            <button className="rounded border px-3 py-2" onClick={next}>下一題</button>
            <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={submitPractice}>交卷看結果</button>
            <p className="self-center text-sm text-slate-500 sm:ml-1">已作答 {answeredCount}/{questions.length}</p>
          </div>
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-sm text-slate-600">題號導覽</p>
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
              {questions.map((q, idx) => {
                const answered = answers[q.id] !== undefined && answers[q.id] !== '';
                const active = idx === currentIndex;
                return (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-8 rounded border text-xs ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : answered
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {submitted && result ? (
        <div className="space-y-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-lg font-semibold">測驗結果：{result.score} 分</p>
            <p className="text-sm text-slate-600">答對 {result.correctCount} / {questions.length} 題（{answeredCount >= questions.length ? '已完成 10 題' : '未全部作答即交卷'}）</p>
            <button className="mt-3 rounded border px-3 py-1" onClick={restartPractice}>再做一次 10 題</button>
          </div>
          {result.detail.map((item, idx) => (
            <div key={item.question.id} className="rounded-lg border bg-white p-4">
              <p className="font-semibold whitespace-pre-line leading-8">第 {idx + 1} 題：{item.question.stem}</p>
              <p className={`mt-1 text-sm ${item.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                {item.correct ? '✅ 答對' : '❌ 答錯'}｜你的答案：{Array.isArray(item.userAnswer) ? item.userAnswer.join(',') : item.userAnswer ?? '未作答'}
              </p>
              <p className="text-sm text-slate-600">正確答案：{Array.isArray(item.question.correctAnswer) ? item.question.correctAnswer.join(',') : item.question.correctAnswer}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">詳解：{item.question.explanation}</p>
            </div>
          ))}
        </div>
      ) : null}
      {!current && <p>請先選章節開始測驗。</p>}
    </div>
  );
}
