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
import { loadCustomKeywords, saveCustomKeywords } from '@/lib/services/custom-keyword-storage';
import { auth } from '@/lib/firebase/client';
import { loadSharedQuestionNote, saveSharedQuestionNote } from '@/lib/services/shared-question-notes';

const fallbackChapters = ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Chapter 6', 'Chapter 7', 'Chapter 8'];

const isQuestionCorrect = (q: Question, userAnswer: string | string[] | undefined) =>
  Array.isArray(q.correctAnswer)
    ? Array.isArray(userAnswer) &&
      q.correctAnswer.length === userAnswer.length &&
      q.correctAnswer.every((x) => userAnswer.includes(x))
    : userAnswer === q.correctAnswer;

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
  const [practiceMode, setPracticeMode] = useState<'single' | 'list'>('single');
  const [customKeywordsByQuestion, setCustomKeywordsByQuestion] = useState<Record<string, DictionaryEntry[]>>({});
  const [notesByQuestion, setNotesByQuestion] = useState<Record<string, string>>({});
  const [revealedByQuestion, setRevealedByQuestion] = useState<Record<string, boolean>>({});
  const [showNotePreview, setShowNotePreview] = useState(false);
  const [showAssistPanel, setShowAssistPanel] = useState(false);
  const [sharedNoteStatus, setSharedNoteStatus] = useState('');
  const questionPanelRef = useRef<HTMLDivElement | null>(null);
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  // Keep a single destructure to avoid accidental duplicate declarations during merge edits.
  const { questions, currentIndex, answers, setSession, setAnswer, setCurrentIndex, next, prev, reset } = usePracticeStore();

  useEffect(() => {
    const loaded = loadQuestionBank();
    setBank(loaded);
    if (loaded[0]?.chapter) setSelectedChapter(loaded[0].chapter);
    setProgress(loadChapterProgress());
    setCustomKeywordsByQuestion(loadCustomKeywords());
  }, []);

  useEffect(() => {
    saveCustomKeywords(customKeywordsByQuestion);
  }, [customKeywordsByQuestion]);

  const current = questions[currentIndex];
  const currentUserId = auth?.currentUser?.uid ?? 'local-user';
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '').length,
    [questions, answers]
  );

  const result = useMemo(() => {
    if (questions.length === 0) return null;
    const detail = questions.map((q) => {
      const userAnswer = answers[q.id];
      const correct = isQuestionCorrect(q, userAnswer);
      return { question: q, userAnswer, correct };
    });
    const correctCount = detail.filter((x) => x.correct).length;
    const score = Math.round((correctCount / questions.length) * 100);
    return { detail, correctCount, score };
  }, [questions, answers]);

  const chapterProgressCards = useMemo(
    () =>
      chapters.map((ch) => {
        const p = progress.find((x) => x.chapter === ch);
        const attempts = p?.attempts ?? 0;
        const completed = p?.completed ?? 0;
        const completionRate = attempts > 0 ? Math.round((completed / attempts) * 100) : 0;
        const lastScore = p?.lastScore ?? 0;
        return { chapter: ch, attempts, completed, completionRate, lastScore };
      }),
    [chapters, progress]
  );
  const selectedChapterProgress = useMemo(
    () => chapterProgressCards.find((x) => x.chapter === selectedChapter) ?? null,
    [chapterProgressCards, selectedChapter]
  );
  const sessionProgressPercent = useMemo(
    () => (questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0),
    [answeredCount, questions.length]
  );

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
    setRevealedByQuestion({});
    setShowAssistPanel(false);
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
        userId: currentUserId,
        questionId: item.question.id,
        isCorrect: item.correct,
        selectedAnswer: Array.isArray(item.userAnswer) ? item.userAnswer : String(item.userAnswer),
        nowISO
      });
    });
    if (questionResults.length > 0) {
      const attempt = buildPracticeAttempt({
        id: `attempt-${Date.now()}`,
        userId: currentUserId,
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
    if (activeKeywordEntries.length === 0) return text;
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
        <span
          key={`${match.index}-${original}`}
          className="underline decoration-amber-500 decoration-2 underline-offset-2"
          title={mapped?.translation ?? original}
        >
          {original}
          {inlineKeywordMode && mapped?.translation ? <span className="ml-1 text-xs text-amber-700">({mapped.translation})</span> : null}
        </span>
      );
      last = pattern.lastIndex;
    }
    if (last < text.length) fragments.push(text.slice(last));
    return fragments;
  };

  const currentNote = current ? notesByQuestion[current.id] ?? '' : '';
  const currentUserAnswer = current ? answers[current.id] : undefined;
  const currentRevealed = current ? !!revealedByQuestion[current.id] : false;
  const currentIsAnswered = currentUserAnswer !== undefined && currentUserAnswer !== '';
  const currentIsCorrect = current ? isQuestionCorrect(current, currentUserAnswer) : false;
  const currentCorrectAnswer = current
    ? (Array.isArray(current.correctAnswer) ? current.correctAnswer.join(', ') : current.correctAnswer)
    : '';
  const updateCurrentNote = (content: string) => {
    if (!current) return;
    setNotesByQuestion((prev) => ({ ...prev, [current.id]: content }));
  };

  const answerCurrentQuestion = (optionKey: string) => {
    if (!current) return;
    setAnswer(current.id, optionKey);
    if (practiceMode === 'single') {
      setRevealedByQuestion((prev) => ({ ...prev, [current.id]: true }));
      setShowAssistPanel(true);
    }
  };

  useEffect(() => {
    if (!current?.id) return;
    let alive = true;
    void (async () => {
      const shared = await loadSharedQuestionNote(current.id);
      if (!alive || !shared) return;
      setNotesByQuestion((prev) => {
        if ((prev[current.id] ?? '').trim().length > 0) return prev;
        return { ...prev, [current.id]: shared.content };
      });
      if (shared.content.trim()) {
        setSharedNoteStatus('已載入共編筆記。');
      }
    })();
    return () => {
      alive = false;
    };
  }, [current?.id]);

  const saveCurrentSharedNote = async () => {
    if (!current) return;
    const res = await saveSharedQuestionNote(current.id, currentNote);
    setSharedNoteStatus(res.ok ? '已儲存到共編筆記。' : `共編筆記儲存失敗：${res.reason}`);
  };

  const applyMarkdownSyntax = (syntax: 'bold' | 'h2' | 'bullet' | 'code') => {
    const textarea = noteEditorRef.current;
    if (!textarea || !current) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const text = currentNote;
    const selected = text.slice(start, end);
    let replacement = selected;
    if (syntax === 'bold') replacement = `**${selected || '重點'}**`;
    if (syntax === 'h2') replacement = `## ${selected || '標題'}`;
    if (syntax === 'bullet') replacement = `- ${selected || '列點內容'}`;
    if (syntax === 'code') replacement = `\`${selected || '關鍵詞'}\``;
    const next = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
    updateCurrentNote(next);
    window.setTimeout(() => {
      const pos = start + replacement.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const renderMarkdownPreview = (markdown: string): ReactNode => {
    const lines = markdown.split('\n');
    return (
      <div className="space-y-1 text-sm">
        {lines.map((line, idx) => {
          if (line.startsWith('## ')) return <h4 key={idx} className="font-semibold">{line.replace(/^## /, '')}</h4>;
          if (line.startsWith('- ')) return <li key={idx} className="ml-5 list-disc">{line.replace(/^- /, '')}</li>;
          const inline = line
            .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1">$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          return <p key={idx} dangerouslySetInnerHTML={{ __html: inline || '&nbsp;' }} />;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chapter Practice</h1>
      <p className="text-sm text-slate-500">目前本機題庫：{bank.length} 題（含 Admin 匯入）</p>
      <div className="grid gap-2 sm:flex sm:items-center">
        <div className="rounded-lg border bg-white px-3 py-2 text-sm">
          目前章節：<span className="font-semibold">{selectedChapter}</span>
          {selectedChapterProgress ? (
            <span className="ml-2 text-slate-500">
              （完成率 {selectedChapterProgress.completionRate}% · 最近 {selectedChapterProgress.lastScore} 分）
            </span>
          ) : null}
        </div>
        <button className="rounded bg-blue-600 px-4 py-3 text-white" onClick={startPractice}>開始 10 題練習（{selectedChapter}）</button>
      </div>
      <div className="rounded-lg border bg-white p-3 text-sm">
        <p className="font-semibold">作答模式</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPracticeMode('single')}
            className={`rounded px-3 py-1.5 ${practiceMode === 'single' ? 'bg-slate-900 text-white' : 'border bg-white'}`}
          >
            逐題即時覆盤（作答後立刻看答案）
          </button>
          <button
            type="button"
            onClick={() => setPracticeMode('list')}
            className={`rounded px-3 py-1.5 ${practiceMode === 'list' ? 'bg-slate-900 text-white' : 'border bg-white'}`}
          >
            清單模式（一次看全部）
          </button>
        </div>
      </div>
      {current && !submitted ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
          <p className="text-sm font-semibold text-blue-900">目前作答章節進度：{selectedChapter}</p>
          <p className="mt-1 text-xs text-blue-800">已作答 {answeredCount}/{questions.length} 題（{sessionProgressPercent}%）</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${sessionProgressPercent}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-blue-700">
            逐題即時覆盤：每題作答後立刻顯示正解與詳解，可馬上補筆記；清單模式仍保留一次看全部。
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold">章節進度總覽（點任一章可切換練習章節）</p>
            <p className="text-xs text-slate-500">桌機一排最多 6 個，手機會自動換行（RWD）。</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {chapterProgressCards.map((item) => (
              <button
                key={item.chapter}
                type="button"
                onClick={() => setSelectedChapter(item.chapter)}
                className={`rounded-xl border p-2 text-left transition ${
                  item.chapter === selectedChapter ? 'border-blue-400 bg-blue-50 shadow-sm' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <p className="truncate text-xs font-semibold">{item.chapter}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-full text-[10px] font-semibold text-slate-700"
                    style={{
                      background: `conic-gradient(#2563eb ${item.completionRate}%, #e2e8f0 0%)`
                    }}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white">{item.completionRate}%</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <p>最近 {item.lastScore} 分</p>
                    <p>完成 {item.completed}/{item.attempts || 0}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && !submitted && practiceMode === 'single' ? (
        <div ref={questionPanelRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm text-slate-500">第 {currentIndex + 1}/{questions.length} 題 · {current.sourceType === 'generated' ? '系統生成題' : '原始題庫'}</p>
          <h2 className="mb-2 whitespace-pre-line text-lg font-semibold leading-8">{renderKeywordMixedText(current.stem)}</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className="rounded border px-2 py-1 hover:bg-slate-50" onClick={() => setShowAssistPanel((v) => !v)}>
              {showAssistPanel ? '收合學習工具與筆記' : '展開學習工具與筆記'}
            </button>
            <button type="button" className="rounded border px-2 py-1 hover:bg-slate-50" onClick={() => setInlineKeywordMode((v) => !v)}>
              {inlineKeywordMode ? '切回原文顯示' : '中英混合顯示'}
            </button>
            <button type="button" className="rounded border px-2 py-1 hover:bg-slate-50" onClick={() => void translateSelectedText(current.id)}>
              快速翻譯選取文字
            </button>
          </div>
          {!showAssistPanel && <p className="mb-3 text-xs text-slate-500">為避免干擾作答，學習工具與筆記預設收合。</p>}
          {isTranslating && <p className="mb-3 text-xs text-slate-500">翻譯中…</p>}
          <div className="space-y-2">
            {current.options.map((opt) => (
              <label
                className={`block rounded-lg border p-3 transition ${
                  answers[current.id] === opt.key ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-400 hover:bg-blue-50'
                }`}
                key={opt.key}
              >
                <input type="radio" className="mr-2" name={current.id} checked={answers[current.id] === opt.key} onChange={() => answerCurrentQuestion(opt.key)} />
                <span className="font-medium">{opt.key}.</span>{' '}
                <span className="whitespace-pre-line leading-7">{renderKeywordMixedText(opt.text)}</span>
              </label>
            ))}
          </div>
          {currentRevealed && (
            <div className={`mt-3 rounded-lg border p-3 text-sm ${currentIsCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
              <p className="font-semibold">{currentIsCorrect ? '✅ 本題答對' : '❌ 本題答錯'}</p>
              <p className="mt-1">你的答案：{Array.isArray(currentUserAnswer) ? currentUserAnswer.join(', ') : currentUserAnswer ?? '未作答'}</p>
              <p className="mt-1">正確答案：{currentCorrectAnswer}</p>
              <p className="mt-2 whitespace-pre-line leading-7">詳解：{current.explanation}</p>
              <p className="mt-2 text-xs text-slate-600">建議：先看完詳解，再在下方「本題筆記」補 1-2 行重點再進下一題。</p>
            </div>
          )}
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
            <button className="rounded border px-3 py-2" onClick={prev}>上一題</button>
            <button
              className="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={next}
              disabled={!currentIsAnswered}
            >
              下一題
            </button>
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
          {showAssistPanel && (
            <div className="mt-4 space-y-3 border-t pt-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">學習工具面板（關鍵字 / 字典 / 翻譯）</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-white" onClick={() => void translateSelectedText(current.id)}>
                    翻譯選取文字
                  </button>
                  <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-white" onClick={() => void translateSelectedText(current.id, true)}>
                    翻譯並加入關鍵字
                  </button>
                  <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-white" onClick={addAllSuggestedTerms}>
                    建議關鍵字全加到字庫
                  </button>
                </div>
                {selectedWord && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
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
                <p className="mt-2 text-xs text-slate-500">目前模式：{inlineKeywordMode ? '中英混合（關鍵字含中文）' : '原文英文'}</p>
                {activeKeywordEntries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
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
                )}
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-indigo-900">本題筆記（Markdown）</p>
                  <button type="button" className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs" onClick={() => setShowNotePreview((v) => !v)}>
                    {showNotePreview ? '回到編輯' : '預覽'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => applyMarkdownSyntax('h2')}>H2</button>
                  <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => applyMarkdownSyntax('bold')}>粗體</button>
                  <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => applyMarkdownSyntax('bullet')}>清單</button>
                  <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => applyMarkdownSyntax('code')}>Code</button>
                  <button type="button" className="rounded border border-indigo-300 bg-white px-2 py-1" onClick={() => void saveCurrentSharedNote()}>
                    儲存共編筆記
                  </button>
                </div>
                {sharedNoteStatus && <p className="mt-1 text-xs text-indigo-700">{sharedNoteStatus}</p>}
                {!showNotePreview ? (
                  <textarea
                    ref={noteEditorRef}
                    className="mt-2 min-h-28 w-full rounded border bg-white p-2 text-sm"
                    placeholder="可用 Markdown：## 標題、**粗體**、- 清單、`code`"
                    value={currentNote}
                    onChange={(e) => updateCurrentNote(e.target.value)}
                  />
                ) : (
                  <div className="mt-2 min-h-28 rounded border bg-white p-2">{renderMarkdownPreview(currentNote)}</div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {questions.length > 0 && !submitted && practiceMode === 'list' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm text-slate-600">清單模式：一次查看全部題目，點題號可快速跳到逐題模式該題。</p>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded border p-3">
                <p className="text-sm font-semibold">第 {idx + 1} 題</p>
                <p className="mt-1 whitespace-pre-line">{q.stem}</p>
                <div className="mt-2 space-y-1">
                  {q.options.map((opt) => (
                    <label key={opt.key} className="block text-sm">
                      <input
                        type="radio"
                        className="mr-2"
                        name={q.id}
                        checked={answers[q.id] === opt.key}
                        onChange={() => setAnswer(q.id, opt.key)}
                      />
                      {opt.key}. {opt.text}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setPracticeMode('single');
                  }}
                >
                  切到逐題模式編輯本題筆記
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={submitPractice}>交卷看結果</button>
            <p className="self-center text-sm text-slate-500">已作答 {answeredCount}/{questions.length}</p>
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
