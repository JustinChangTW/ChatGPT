'use client';

import Link from 'next/link';
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import { sampleQuestions } from '@/lib/mocks/sample-questions';
import { loadQuestionBank } from '@/lib/services/local-question-bank';
import { loadWrongNotebook } from '@/lib/services/wrong-notebook-storage';
import { requestAITutorReplyDebug } from '@/lib/services/ai-tutor-client';
import { loadSharedQuestionNote } from '@/lib/services/shared-question-notes';
import { loadPrivateQuestionNote } from '@/lib/services/private-question-notes';
import { loadCustomKeywords } from '@/lib/services/custom-keyword-storage';
import { auth } from '@/lib/firebase/client';
import { getBuiltinDictionaryTerms, lookupDictionaryTerm } from '@/lib/services/inline-dictionary';

const NOTEBOOK_UI_PREFS_KEY = 'cct_wrong_notebook_ui_prefs_v1';

type NotebookRowVM = {
  id: string;
  questionId: string;
  shortId: string;
  chapter: string;
  domain: string;
  domainShort: string;
  questionType: string;
  mastered: boolean;
  attempts: number;
  wrongCount: number;
  correctCount: number;
  wrongRate: number;
  recentAt: string;
  stemPreview: string;
  question?: {
    stem: string;
    options: Array<{ key: string; text: string }>;
    correctAnswer: string | string[];
    explanation: string;
    chapter: string;
    domain: string;
  };
};

function aiTutorReply(question: string, explanation: string, history: { role: 'user' | 'assistant'; text: string }[]): string {
  const latest = history[history.length - 1]?.text ?? '';
  return `AI 助教（示範）\n你問：「${latest}」\n\n重點：${question}\n建議理解方向：${explanation}\n\n追問建議：\n1) 這題考點和常見陷阱是什麼？\n2) 若換成實作題要怎麼判斷？\n3) 請用一步一步方式再解一次。`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeShortId(questionId: string): string {
  if (questionId.length <= 18) return questionId;
  return `${questionId.slice(0, 10)}…${questionId.slice(-6)}`;
}

function makeDomainShort(domain: string): string {
  if (!domain || domain === '-') return '-';
  return domain.split(' ').map((x) => x[0]).join('').slice(0, 6) || domain.slice(0, 8);
}

function WrongRowItem({
  row,
  selected,
  onSelect
}: {
  row: NotebookRowVM;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${selected ? 'border-blue-500 bg-blue-50/70' : 'bg-white hover:bg-slate-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500">{row.shortId}</p>
          <p className="mt-1 text-sm text-slate-800">{row.stemPreview.length > 90 ? `${row.stemPreview.slice(0, 90)}…` : row.stemPreview}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-rose-700">{row.wrongRate}%</p>
          <p className="text-xs text-slate-500">錯 {row.wrongCount} 次</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{row.chapter}</span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700" title={row.domain}>{row.domainShort}</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">{row.questionType}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${row.mastered ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {row.mastered ? '已掌握' : '未掌握'}
        </span>
      </div>
    </button>
  );
}

function DetailPanel({
  row,
  keywordHints,
  renderStemWithKeywordUnderline,
  notes,
  chat,
  aiError,
  askValue,
  setAskValue,
  asking,
  onSendAsk
}: {
  row: NotebookRowVM | null;
  keywordHints: { term: string; translation: string }[];
  renderStemWithKeywordUnderline: (stem: string, terms: string[]) => ReactNode;
  notes: { shared: string; private: string };
  chat: { role: 'user' | 'assistant'; text: string }[];
  aiError: string;
  askValue: string;
  setAskValue: (v: string) => void;
  asking: boolean;
  onSendAsk: () => void;
}) {
  if (!row?.question) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-500">請先從左側選一題查看詳情。</div>;
  }
  const q = row.question;
  return (
    <div className="space-y-3 rounded-xl border bg-white p-4 lg:sticky lg:top-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500">{row.questionId}</p>
          <h2 className="mt-1 text-base font-semibold leading-7">{renderStemWithKeywordUnderline(q.stem, keywordHints.map((x) => x.term))}</h2>
        </div>
        <Link href={`/practice/chapter?chapter=${encodeURIComponent(row.chapter)}&focus=${encodeURIComponent(row.questionId)}`} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">
          重新練習
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border bg-slate-50 p-2">Attempts：{row.attempts}</div>
        <div className="rounded border bg-rose-50 p-2 text-rose-700">Wrong：{row.wrongCount}</div>
        <div className="rounded border bg-emerald-50 p-2 text-emerald-700">Correct：{row.correctCount}</div>
        <div className="rounded border bg-slate-50 p-2">Wrong%：{row.wrongRate}%</div>
      </div>

      <div className="rounded border bg-slate-50 p-3 text-sm">
        <p className="font-semibold">選項</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {q.options.map((o) => (
            <li key={o.key}>{o.key}. {o.text}</li>
          ))}
        </ul>
        <p className="mt-2 text-slate-700">正確答案：{Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}</p>
        <p className="mt-1 text-slate-700">詳解：{q.explanation}</p>
        <p className="mt-1 text-xs text-slate-500">完整領域：{row.domain}</p>
      </div>

      <div className="rounded border bg-amber-50 p-3 text-sm">
        <p className="font-semibold text-amber-900">關鍵字提示</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {keywordHints.length === 0 ? <span className="text-xs text-amber-800">此題尚無關鍵字。</span> : keywordHints.map((entry) => (
            <span key={entry.term} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs text-amber-900">
              {entry.translation ? `${entry.term} · ${entry.translation}` : entry.term}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded border bg-white p-2 text-xs"><p className="font-semibold text-indigo-700">共編筆記</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{notes.shared || '尚無共編筆記。'}</p></div>
        <div className="rounded border bg-white p-2 text-xs"><p className="font-semibold text-slate-700">私人筆記</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{notes.private || '尚無私人筆記。'}</p></div>
      </div>

      <div className="rounded border bg-slate-50 p-3">
        <p className="mb-2 text-sm font-semibold">AI 助教互動</p>
        {aiError && <pre className="mb-2 whitespace-pre-wrap rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{aiError}</pre>}
        <div className="max-h-40 space-y-2 overflow-auto rounded border bg-white p-2 text-sm">
          {chat.length === 0 ? <p className="text-slate-500">尚未提問。</p> : chat.map((m, idx) => <p key={idx} className={m.role === 'user' ? 'text-blue-900' : 'text-slate-700'}>{m.role === 'user' ? '你：' : 'AI：'}{m.text}</p>)}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="w-full rounded border px-2 py-1 text-sm" value={askValue} onChange={(e) => setAskValue(e.target.value)} placeholder="輸入追問" />
          <button className="rounded border px-2 py-1 text-sm" onClick={onSendAsk} disabled={asking}>{asking ? '送出中' : '送出'}</button>
        </div>
      </div>
    </div>
  );
}

export default function WrongNotebookPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [query, setQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [masteredFilter, setMasteredFilter] = useState<'all' | 'mastered' | 'unmastered'>('all');
  const [sortBy, setSortBy] = useState<'wrongRate' | 'wrongCount' | 'attempts' | 'recent'>('wrongRate');
  const [layoutMode, setLayoutMode] = useState<'splitList' | 'splitBalanced' | 'splitDetail' | 'stacked' | 'drawer'>('splitBalanced');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailPanelPercent, setDetailPanelPercent] = useState(50);
  const [drawerWidth, setDrawerWidth] = useState(760);
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const [askByQuestion, setAskByQuestion] = useState<Record<string, string>>({});
  const [isAskingByQuestion, setIsAskingByQuestion] = useState<Record<string, boolean>>({});
  const [aiErrorByQuestion, setAiErrorByQuestion] = useState<Record<string, string>>({});
  const [chat, setChat] = useState<Record<string, { role: 'user' | 'assistant'; text: string }[]>>({});
  const [wrongRows] = useState(() => loadWrongNotebook());
  const [notesByQuestion, setNotesByQuestion] = useState<Record<string, { shared: string; private: string }>>({});
  const [customKeywordsByQuestion, setCustomKeywordsByQuestion] = useState(() => loadCustomKeywords());
  const currentUserId = auth?.currentUser?.uid ?? 'local-user';

  const questionPool = useMemo(() => {
    const local = loadQuestionBank();
    return new Map([...sampleQuestions, ...local].map((q) => [q.id, q]));
  }, []);

  const enriched: NotebookRowVM[] = useMemo(() => wrongRows.map((r) => {
    const question = questionPool.get(r.questionId);
    const correctCount = r.correctCount ?? 0;
    const wrongCount = r.wrongCount ?? 0;
    const attempts = wrongCount + correctCount;
    const recentAt = r.lastWrongAt ?? r.lastCorrectAt ?? '';
    return {
      id: r.id,
      questionId: r.questionId,
      shortId: makeShortId(r.questionId),
      chapter: question?.chapter ?? '-',
      domain: question?.domain ?? '-',
      domainShort: makeDomainShort(question?.domain ?? '-'),
      questionType: question?.questionType ?? 'theory',
      mastered: !!r.mastered,
      attempts,
      correctCount,
      wrongCount,
      wrongRate: attempts > 0 ? Math.round((wrongCount / attempts) * 100) : 0,
      recentAt,
      stemPreview: question?.stem ?? '(無題目內容)',
      question: question
        ? {
            stem: question.stem,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            chapter: question.chapter,
            domain: question.domain
          }
        : undefined
    };
  }), [questionPool, wrongRows]);

  const summary = useMemo(() => ({
    totalQuestions: enriched.length,
    totalAttempts: enriched.reduce((acc, x) => acc + x.attempts, 0),
    totalWrong: enriched.reduce((acc, x) => acc + x.wrongCount, 0),
    totalCorrect: enriched.reduce((acc, x) => acc + x.correctCount, 0)
  }), [enriched]);

  const chapterOptions = useMemo(() => Array.from(new Set(enriched.map((x) => x.chapter))).filter(Boolean), [enriched]);
  const domainOptions = useMemo(() => Array.from(new Set(enriched.map((x) => x.domain))).filter(Boolean), [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = enriched.filter((row) => {
      const queryHit = !q || row.questionId.toLowerCase().includes(q) || row.stemPreview.toLowerCase().includes(q);
      const chapterHit = chapterFilter === 'all' || row.chapter === chapterFilter;
      const domainHit = domainFilter === 'all' || row.domain === domainFilter;
      const typeHit = typeFilter === 'all' || row.questionType === typeFilter;
      const masteredHit = masteredFilter === 'all' || (masteredFilter === 'mastered' ? row.mastered : !row.mastered);
      return queryHit && chapterHit && domainHit && typeHit && masteredHit;
    });

    rows.sort((a, b) => {
      if (sortBy === 'wrongRate') return b.wrongRate - a.wrongRate;
      if (sortBy === 'wrongCount') return b.wrongCount - a.wrongCount;
      if (sortBy === 'attempts') return b.attempts - a.attempts;
      return (b.recentAt || '').localeCompare(a.recentAt || '');
    });
    return rows;
  }, [chapterFilter, domainFilter, enriched, masteredFilter, query, sortBy, typeFilter]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].questionId);
      return;
    }
    if (selectedId && !filtered.some((x) => x.questionId === selectedId)) {
      setSelectedId(filtered[0]?.questionId ?? null);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    setVisibleCount(10);
  }, [query, chapterFilter, domainFilter, typeFilter, masteredFilter, sortBy]);

  const keywordHintsByQuestion = useMemo(() => {
    const dictTerms = new Set(getBuiltinDictionaryTerms());
    const map: Record<string, { term: string; translation: string }[]> = {};
    enriched.forEach((row) => {
      if (!row.question) return;
      const text = [row.question.stem, ...row.question.options.map((o) => o.text)].join(' ');
      const tokens = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
      const suggestedEntries = Array.from(new Set(tokens.map((x) => x.toLowerCase()).filter((x) => dictTerms.has(x))))
        .map((term) => lookupDictionaryTerm(term))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((entry) => ({ term: entry.term, translation: entry.translation }));
      const customEntries = (customKeywordsByQuestion[row.questionId] ?? []).map((entry) => ({ term: entry.term, translation: entry.translation ?? '' }));
      const mergedMap = new Map<string, { term: string; translation: string }>();
      [...suggestedEntries, ...customEntries].forEach((entry) => mergedMap.set(entry.term.toLowerCase(), entry));
      map[row.questionId] = Array.from(mergedMap.values()).slice(0, 8);
    });
    return map;
  }, [customKeywordsByQuestion, enriched]);

  useEffect(() => {
    setCustomKeywordsByQuestion(loadCustomKeywords());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(NOTEBOOK_UI_PREFS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        layoutMode?: 'splitList' | 'splitBalanced' | 'splitDetail' | 'stacked' | 'drawer';
        detailPanelPercent?: number;
        drawerWidth?: number;
        sortBy?: 'wrongRate' | 'wrongCount' | 'attempts' | 'recent';
      };
      if (parsed.layoutMode) setLayoutMode(parsed.layoutMode);
      if (typeof parsed.detailPanelPercent === 'number') setDetailPanelPercent(parsed.detailPanelPercent);
      if (typeof parsed.drawerWidth === 'number') setDrawerWidth(parsed.drawerWidth);
      if (parsed.sortBy) setSortBy(parsed.sortBy);
    } catch {
      // ignore broken persisted prefs
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      NOTEBOOK_UI_PREFS_KEY,
      JSON.stringify({ layoutMode, detailPanelPercent, drawerWidth, sortBy })
    );
  }, [layoutMode, detailPanelPercent, drawerWidth, sortBy]);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    void (async () => {
      const shared = await loadSharedQuestionNote(selectedId);
      const privateNote = loadPrivateQuestionNote(currentUserId, selectedId);
      if (!alive) return;
      setNotesByQuestion((prev) => ({ ...prev, [selectedId]: { shared: shared?.content ?? '', private: privateNote } }));
    })();
    return () => { alive = false; };
  }, [currentUserId, selectedId]);

  useEffect(() => {
    if (!isResizingDrawer) return;
    const handleMove = (event: MouseEvent) => {
      const viewport = window.innerWidth;
      const next = Math.min(Math.max(viewport - event.clientX, 420), viewport);
      setDrawerWidth(next);
    };
    const handleUp = () => setIsResizingDrawer(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingDrawer]);

  const selected = useMemo(() => enriched.find((x) => x.questionId === selectedId) ?? null, [enriched, selectedId]);
  const setDrawerViewportRatio = (ratio: number) => {
    if (typeof window === 'undefined') return;
    setDrawerWidth(Math.round(window.innerWidth * ratio));
  };

  const sendAsk = async (questionId: string, stem: string, explanation: string) => {
    const userText = (askByQuestion[questionId] ?? '').trim();
    if (!userText) return;
    const nextHistory = [...(chat[questionId] ?? []), { role: 'user' as const, text: userText }];
    setIsAskingByQuestion((prev) => ({ ...prev, [questionId]: true }));
    const cloud = await requestAITutorReplyDebug(stem, explanation, nextHistory);
    const reply = cloud.reply ?? aiTutorReply(stem, explanation, nextHistory);
    setIsAskingByQuestion((prev) => ({ ...prev, [questionId]: false }));
    setAiErrorByQuestion((prev) => ({ ...prev, [questionId]: cloud.reply ? '' : `錯誤：${cloud.error ?? '未知錯誤'}` }));
    setChat((s) => ({ ...s, [questionId]: [...nextHistory, { role: 'assistant', text: reply }] }));
    setAskByQuestion((prev) => ({ ...prev, [questionId]: '' }));
  };

  const renderStemWithKeywordUnderline = (stem: string, terms: string[]): ReactNode => {
    if (!terms.length) return stem;
    const uniqueTerms = Array.from(new Set(terms.map((x) => x.trim()).filter(Boolean))).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(${uniqueTerms.map((x) => escapeRegExp(x)).join('|')})`, 'ig');
    return stem.split(regex).map((part, idx) => {
      const matched = uniqueTerms.some((term) => term.toLowerCase() === part.toLowerCase());
      return matched ? <u key={`stem-${idx}`} className="decoration-2 underline-offset-2">{part}</u> : <span key={`stem-${idx}`}>{part}</span>;
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">錯題本</h1>
      <p className="text-sm text-slate-500">快速找出高錯誤題、即時篩選、右側固定詳情快速複習。</p>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded border bg-white p-3 text-sm"><p className="text-xs text-slate-500">題目數</p><p className="text-xl font-semibold">{summary.totalQuestions}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-xs text-slate-500">總作答次數</p><p className="text-xl font-semibold">{summary.totalAttempts}</p></div>
        <div className="rounded border bg-rose-50 p-3 text-sm"><p className="text-xs text-rose-700">總答錯次數</p><p className="text-xl font-semibold text-rose-700">{summary.totalWrong}</p></div>
        <div className="rounded border bg-emerald-50 p-3 text-sm"><p className="text-xs text-emerald-700">總答對次數</p><p className="text-xl font-semibold text-emerald-700">{summary.totalCorrect}</p></div>
      </div>

      <div className="rounded-xl border bg-white p-3">
        <div className="grid gap-2 md:grid-cols-6">
          <input className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="搜尋題號或題目文字" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="rounded border px-2 py-1 text-sm" value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}>
            <option value="all">全部章節</option>{chapterOptions.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="rounded border px-2 py-1 text-sm" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            <option value="all">全部領域</option>{domainOptions.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="rounded border px-2 py-1 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">全部題型</option><option value="theory">theory</option><option value="practical">practical</option>
          </select>
          <select className="rounded border px-2 py-1 text-sm" value={masteredFilter} onChange={(e) => setMasteredFilter(e.target.value as 'all' | 'mastered' | 'unmastered')}>
            <option value="all">全部掌握狀態</option><option value="unmastered">未掌握</option><option value="mastered">已掌握</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">排序</label>
          <select className="rounded border px-2 py-1 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'wrongRate' | 'wrongCount' | 'attempts' | 'recent')}>
            <option value="wrongRate">wrong%</option>
            <option value="wrongCount">wrong count</option>
            <option value="attempts">attempts</option>
            <option value="recent">recent</option>
          </select>
          <label className="ml-2 text-xs text-slate-500">版型</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={layoutMode}
            onChange={(e) => {
              const mode = e.target.value as 'splitList' | 'splitBalanced' | 'splitDetail' | 'stacked' | 'drawer';
              setLayoutMode(mode);
              setDrawerOpen(false);
              if (mode === 'splitList') setDetailPanelPercent(40);
              if (mode === 'splitBalanced') setDetailPanelPercent(50);
              if (mode === 'splitDetail') setDetailPanelPercent(60);
            }}
          >
            <option value="splitList">雙欄：列表優先</option>
            <option value="splitBalanced">雙欄：平均</option>
            <option value="splitDetail">雙欄：詳情優先</option>
            <option value="stacked">上下堆疊</option>
            <option value="drawer">右側抽屜</option>
          </select>
          {layoutMode !== 'drawer' && (
            <>
              <label className="ml-2 text-xs text-slate-500">詳情寬度</label>
              <div className="flex gap-1">
                {[50, 70, 90, 100].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    className={`rounded border px-2 py-1 text-xs ${detailPanelPercent === percent ? 'bg-slate-900 text-white' : 'bg-white'}`}
                    onClick={() => setDetailPanelPercent(percent)}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="text-xs text-slate-500">共 {filtered.length} 題</span>
        </div>
      </div>

      {(() => {
        const listBlock = (
          <div className="space-y-2 rounded-xl border bg-slate-50 p-2">
            {visibleRows.length === 0 ? <p className="rounded-lg border bg-white p-3 text-sm text-slate-500">沒有符合篩選條件的錯題。</p> : visibleRows.map((row) => (
              <WrongRowItem
                key={row.questionId}
                row={row}
                selected={row.questionId === selectedId}
                onSelect={() => {
                  setSelectedId(row.questionId);
                  if (layoutMode === 'drawer') setDrawerOpen(true);
                }}
              />
            ))}
            {visibleCount < filtered.length && (
              <div className="flex justify-center pt-1">
                <button className="rounded border bg-white px-3 py-1 text-sm hover:bg-slate-50" onClick={() => setVisibleCount((v) => v + 10)}>顯示更多</button>
              </div>
            )}
          </div>
        );
        const detailBlock = (
          <DetailPanel
            row={selected}
            keywordHints={selectedId ? keywordHintsByQuestion[selectedId] ?? [] : []}
            renderStemWithKeywordUnderline={renderStemWithKeywordUnderline}
            notes={selectedId ? notesByQuestion[selectedId] ?? { shared: '', private: '' } : { shared: '', private: '' }}
            chat={selectedId ? chat[selectedId] ?? [] : []}
            aiError={selectedId ? aiErrorByQuestion[selectedId] ?? '' : ''}
            askValue={selectedId ? askByQuestion[selectedId] ?? '' : ''}
            setAskValue={(v) => selectedId && setAskByQuestion((prev) => ({ ...prev, [selectedId]: v }))}
            asking={selectedId ? !!isAskingByQuestion[selectedId] : false}
            onSendAsk={() => {
              if (!selectedId || !selected?.question) return;
              void sendAsk(selectedId, selected.question.stem, selected.question.explanation);
            }}
          />
        );

        if (layoutMode === 'stacked') {
          return detailPanelPercent === 100 ? <div>{detailBlock}</div> : <div className="space-y-3">{listBlock}{detailBlock}</div>;
        }
        if (layoutMode === 'drawer') {
          return (
            <>
              {listBlock}
              {drawerOpen && (
                <div className="fixed inset-0 z-40">
                  <button type="button" className="absolute inset-0 bg-black/20" onClick={() => setDrawerOpen(false)} />
                  <div
                    className="absolute right-0 top-0 h-full overflow-auto border-l bg-slate-100 p-3"
                    style={{ width: `${drawerWidth}px`, maxWidth: '100vw' }}
                  >
                    <button
                      type="button"
                      className="absolute left-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize bg-transparent"
                      onMouseDown={() => setIsResizingDrawer(true)}
                      aria-label="調整抽屜寬度"
                    />
                    <div className="mb-2 flex flex-wrap justify-end gap-1">
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => setDrawerWidth(460)}>最小</button>
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => setDrawerWidth(760)}>中</button>
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => setDrawerWidth(980)}>最大</button>
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => setDrawerViewportRatio(0.9)}>90%</button>
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => setDrawerViewportRatio(1)}>100%</button>
                      <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => setDrawerOpen(false)}>關閉</button>
                    </div>
                    {detailBlock}
                  </div>
                </div>
              )}
            </>
          );
        }

        if (detailPanelPercent === 100) return <div>{detailBlock}</div>;
        const listPercent = Math.max(8, 100 - detailPanelPercent);
        const cols = `${listPercent}% ${detailPanelPercent}%`;
        return (
          <div className="grid gap-3 lg:[grid-template-columns:var(--wn-cols)]" style={{ '--wn-cols': cols } as CSSProperties}>
            {listBlock}
            {detailBlock}
          </div>
        );
      })()}
    </div>
  );
}
