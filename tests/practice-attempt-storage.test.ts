import { describe, expect, it } from 'vitest';
import { savePracticeAttempt, loadPracticeAttempts, deletePracticeAttempt } from '../lib/services/practice-attempt-storage';
import { buildPracticeAttempt } from '../lib/services/practice-attempt-service';

describe('practice attempt storage', () => {
  it('saves and loads attempts', () => {
    const attempt = buildPracticeAttempt({
      id: 'a-1',
      userId: 'local-user',
      mode: 'chapter',
      selectedChapter: '第1章',
      questionResults: [
        {
          questionId: 'q-1',
          sourceType: 'original',
          userAnswer: 'A',
          correctAnswer: 'A',
          isCorrect: true,
          chapter: '第1章',
          domain: 'D1',
          questionType: 'theory'
        }
      ],
      startedAt: new Date(Date.now() - 1000).toISOString(),
      submittedAt: new Date().toISOString()
    });
    savePracticeAttempt(attempt);
    const loaded = loadPracticeAttempts();
    expect(loaded[0].id).toBe('a-1');
  });

  it('deletes attempt by id', () => {
    const after = deletePracticeAttempt('a-1');
    expect(after.find((x) => x.id === 'a-1')).toBeUndefined();
  });
});
