'use client';

import { useMemo, useState } from 'react';
import {
  VocabularyEntry,
  clearVocabularyBank,
  loadVocabularyBank,
  removeVocabularyEntry,
  setVocabularyProficiency,
  updateVocabularyEntry
} from '@/lib/services/vocabulary-storage';
import { fetchRealtimeTranslation } from '@/lib/services/realtime-translation';

const PROFICIENCY_OPTIONS: Array<{ value: VocabularyEntry['proficiencyLevel']; label: string; hint: string }> = [
  { value: 'new', label: 'Lv0 新字', hint: '剛加入，幾乎不熟' },
  { value: 'learning', label: 'Lv1 學習中', hint: '看過但常忘記' },
  { value: 'familiar', label: 'Lv2 熟悉', hint: '多數情境可辨識' },
  { value: 'mastered', label: 'Lv3 精通', hint: '可穩定理解與使用' }
];

export default function VocabularyPage() {
  const [entries, setEntries] = useState<VocabularyEntry[]>(loadVocabularyBank());
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editDefinition, setEditDefinition] = useState('');
  const [hydratingIds, setHydratingIds] = useState<string[]>([]);
  const [actionHint, setActionHint] = useState('');

  const reviewList = useMemo(
    () => [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries]
  );
  const current = reviewList[reviewIndex] ?? null;

  const nextCard = () => {
    if (reviewList.length === 0) return;
    setReviewIndex((idx) => (idx + 1) % reviewList.length);
    setRevealed(false);
  };

  const deleteEntry = (id: string) => {
    const next = removeVocabularyEntry(id);
    setEntries(next);
    setReviewIndex(0);
    setRevealed(false);
  };

  const clearAll = () => {
    const next = clearVocabularyBank();
    setEntries(next);
    setReviewIndex(0);
    setRevealed(false);
  };

  const updateLevel = (id: string, level: VocabularyEntry['proficiencyLevel']) => {
    const next = setVocabularyProficiency(id, level);
    setEntries(next);
  };

  const startEdit = (entry: VocabularyEntry) => {
    setEditingId(entry.id);
    setEditTerm(entry.term);
    setEditTranslation(entry.translation);
    setEditDefinition(entry.definition);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTerm('');
    setEditTranslation('');
    setEditDefinition('');
  };

  const saveEdit = (id: string) => {
    if (!editTerm.trim()) return;
    const next = updateVocabularyEntry(id, {
      term: editTerm,
      translation: editTranslation || '（尚未填寫）',
      definition: editDefinition || '（尚未填寫）'
    });
    setEntries(next);
    cancelEdit();
  };

  const needsHydration = (entry: VocabularyEntry): boolean =>
    entry.translation.includes('暫無內建翻譯') || entry.translation.includes('查無中文翻譯') || entry.translation.includes('尚未填寫');

  const hydrateEntry = async (entry: VocabularyEntry) => {
    setHydratingIds((prev) => [...prev, entry.id]);
    const realtime = await fetchRealtimeTranslation(entry.term);
    setHydratingIds((prev) => prev.filter((x) => x !== entry.id));
    if (!realtime) {
      setActionHint(`補齊失敗：${entry.term}（請稍後再試）`);
      return;
    }
    const next = updateVocabularyEntry(entry.id, {
      translation: realtime.translation,
      definition: realtime.definition,
      phonetic: realtime.phonetic,
      audioUrl: realtime.audioUrl
    });
    setEntries(next);
    setActionHint(`已補上：${entry.term}`);
  };

  const hydrateAllMissing = async () => {
    const targets = entries.filter(needsHydration);
    if (targets.length === 0) {
      setActionHint('目前沒有需要補齊翻譯的單字。');
      return;
    }
    for (const entry of targets) {
      // eslint-disable-next-line no-await-in-loop
      await hydrateEntry(entry);
    }
    setActionHint(`已完成補齊，共處理 ${targets.length} 筆。`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">單字管理與複習</h1>
        <button
          type="button"
          onClick={clearAll}
          className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
          disabled={entries.length === 0}
        >
          清空單字庫
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">複習卡</h2>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
          {PROFICIENCY_OPTIONS.map((option) => (
            <li key={option.value}>
              <span className="font-medium">{option.label}</span>：{option.hint}
            </li>
          ))}
        </ul>
        {!current ? (
          <p className="text-sm text-slate-500">目前沒有單字，先到章節練習加入單字。</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">第 {reviewIndex + 1} / {reviewList.length} 張</p>
            <p className="text-2xl font-bold">{current.term}</p>
            <p className="text-xs text-slate-500">
              目前熟練度：{PROFICIENCY_OPTIONS.find((x) => x.value === current.proficiencyLevel)?.label ?? current.proficiencyLevel}
            </p>
            {current.phonetic && <p className="text-sm text-slate-600">發音：{current.phonetic}</p>}
            {current.audioUrl && (
              <audio className="w-full max-w-xs" controls src={current.audioUrl}>
                您的瀏覽器不支援 audio 播放。
              </audio>
            )}
            {revealed ? (
              <>
                <p className="text-lg text-amber-700">{current.translation}</p>
                <p className="text-sm text-slate-700">{current.definition}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">先想看看意思，再按「顯示答案」</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="rounded border px-3 py-1 text-sm hover:bg-slate-50"
              >
                {revealed ? '隱藏答案' : '顯示答案'}
              </button>
              <button type="button" onClick={nextCard} className="rounded border px-3 py-1 text-sm hover:bg-slate-50">
                下一張
              </button>
              <button
                type="button"
                onClick={() => deleteEntry(current.id)}
                className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
              >
                移除此字
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROFICIENCY_OPTIONS.map((option) => (
                <button
                  key={`review-${option.value}`}
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() => updateLevel(current.id, option.value)}
                >
                  標記 {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">單字清單</h2>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-slate-500">每個單字都可按「編輯」修改英文、翻譯與解釋。</p>
          <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-slate-50" onClick={hydrateAllMissing}>
            一鍵補上缺少翻譯/發音
          </button>
        </div>
        {actionHint && <p className="mb-2 text-xs text-emerald-700">{actionHint}</p>}
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">尚無單字。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded border p-3">
                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded border px-2 py-1"
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      placeholder="英文單字"
                    />
                    <input
                      className="w-full rounded border px-2 py-1"
                      value={editTranslation}
                      onChange={(e) => setEditTranslation(e.target.value)}
                      placeholder="中文翻譯"
                    />
                    <textarea
                      className="w-full rounded border px-2 py-1"
                      rows={2}
                      value={editDefinition}
                      onChange={(e) => setEditDefinition(e.target.value)}
                      placeholder="補充解釋"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => saveEdit(entry.id)}>
                        儲存
                      </button>
                      <button type="button" className="rounded border px-2 py-1 text-xs" onClick={cancelEdit}>
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-semibold">{entry.term} → {entry.translation}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      熟練度：{PROFICIENCY_OPTIONS.find((x) => x.value === entry.proficiencyLevel)?.label ?? entry.proficiencyLevel}
                    </p>
                    {entry.phonetic && <p className="mt-1 text-xs text-slate-600">發音：{entry.phonetic}</p>}
                    {entry.audioUrl && (
                      <audio className="mt-1 w-full max-w-xs" controls src={entry.audioUrl}>
                        您的瀏覽器不支援 audio 播放。
                      </audio>
                    )}
                    <p className="mt-1 text-slate-600">{entry.definition}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => startEdit(entry)}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                        onClick={() => deleteEntry(entry.id)}
                      >
                        刪除
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => hydrateEntry(entry)}
                        disabled={hydratingIds.includes(entry.id)}
                      >
                        {hydratingIds.includes(entry.id) ? '補齊中…' : '補上翻譯/發音'}
                      </button>
                      {PROFICIENCY_OPTIONS.map((option) => (
                        <button
                          key={`${entry.id}-${option.value}`}
                          type="button"
                          className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                          onClick={() => updateLevel(entry.id, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
