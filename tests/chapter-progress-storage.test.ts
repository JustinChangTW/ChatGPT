import { describe, expect, it } from 'vitest';
import { loadChapterProgress, updateChapterProgress } from '../lib/services/chapter-progress-storage';

describe('chapter progress storage', () => {
  it('updates attempts/completed counters', () => {
    const first = updateChapterProgress({ chapter: '第1章', totalQuestions: 10, score: 80, completed: true });
    expect(first.attempts).toBe(1);
    expect(first.completed).toBe(1);

    const second = updateChapterProgress({ chapter: '第1章', totalQuestions: 10, score: 60, completed: false });
    expect(second.attempts).toBe(2);
    expect(second.completed).toBe(1);

    const all = loadChapterProgress();
    expect(all.find((x) => x.chapter === '第1章')?.attempts).toBe(2);
  });
});

