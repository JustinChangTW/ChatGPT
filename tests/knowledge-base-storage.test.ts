import { describe, expect, it } from 'vitest';
import { loadKnowledgeBaseEntries, saveKnowledgeBaseEntries } from '../lib/services/knowledge-base-storage';

describe('knowledge base storage', () => {
  it('supports save/load for json-maintained entries', () => {
    const saved = saveKnowledgeBaseEntries([
      {
        id: 'kb-custom-1',
        chapterNo: 2,
        chapterTitle: 'Network Security',
        title: 'Custom Topic',
        summary: 'Custom summary',
        keyPoints: ['A', 'B'],
        examSignals: ['S1'],
        tags: ['chapter-2', 'custom']
      }
    ]);
    expect(saved).toHaveLength(1);
    const loaded = loadKnowledgeBaseEntries();
    expect(loaded[0].id).toBe('kb-custom-1');
    expect(loaded[0].chapterNo).toBe(2);
  });
});
