import { CCTKnowledgeItem, CCT_KNOWLEDGE_BASE } from '@/lib/knowledge/cct-knowledge-base';

const STORAGE_KEY = 'cct_knowledge_base_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function normalizeEntry(entry: CCTKnowledgeItem): CCTKnowledgeItem {
  return {
    id: entry.id.trim(),
    chapterNo: Number(entry.chapterNo) || 1,
    chapterTitle: entry.chapterTitle.trim(),
    title: entry.title.trim(),
    summary: entry.summary.trim(),
    keyPoints: entry.keyPoints.map((x) => x.trim()).filter(Boolean),
    examSignals: entry.examSignals.map((x) => x.trim()).filter(Boolean),
    tags: entry.tags.map((x) => x.trim().toLowerCase()).filter(Boolean)
  };
}

export function loadKnowledgeBaseEntries(): CCTKnowledgeItem[] {
  if (!isBrowser()) return CCT_KNOWLEDGE_BASE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return CCT_KNOWLEDGE_BASE;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return CCT_KNOWLEDGE_BASE;
    return parsed.map((entry) => normalizeEntry(entry as CCTKnowledgeItem));
  } catch {
    return CCT_KNOWLEDGE_BASE;
  }
}

export function saveKnowledgeBaseEntries(entries: CCTKnowledgeItem[]): CCTKnowledgeItem[] {
  const normalized = entries.map(normalizeEntry);
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function resetKnowledgeBaseEntries(): CCTKnowledgeItem[] {
  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return CCT_KNOWLEDGE_BASE;
}
