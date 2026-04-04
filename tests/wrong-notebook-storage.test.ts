import { describe, expect, it } from 'vitest';
import { loadWrongNotebook, recordWrongNotebook, rebuildWrongNotebookFromAttempts } from '../lib/services/wrong-notebook-storage';
import { buildPracticeAttempt } from '../lib/services/practice-attempt-service';

describe('wrong notebook storage', () => {
  it('records and updates wrong notebook rows', () => {
    const first = recordWrongNotebook({
      userId: 'local-user',
      questionId: 'q-001',
      isCorrect: false,
      selectedAnswer: 'A'
    });
    expect(first.wrongCount).toBe(1);

    const second = recordWrongNotebook({
      userId: 'local-user',
      questionId: 'q-001',
      isCorrect: true,
      selectedAnswer: 'B'
    });
    expect(second.correctCount).toBe(1);

    const all = loadWrongNotebook();
    expect(all.length).toBe(1);
    expect(all[0].questionId).toBe('q-001');
  });

  it('rebuilds wrong notebook from attempts', () => {
    const attempt = buildPracticeAttempt({
      id: 'exam-1',
      userId: 'local-user',
      mode: 'exam',
      questionResults: [
        {
          questionId: 'q-009',
          sourceType: 'original',
          userAnswer: 'A',
          correctAnswer: 'B',
          isCorrect: false,
          chapter: '第1章',
          domain: 'D1',
          questionType: 'theory'
        }
      ],
      startedAt: new Date(Date.now() - 1000).toISOString(),
      submittedAt: new Date().toISOString()
    });
    const rebuilt = rebuildWrongNotebookFromAttempts([attempt], 'local-user');
    expect(rebuilt.length).toBe(1);
    expect(rebuilt[0].questionId).toBe('q-009');
    expect(rebuilt[0].wrongCount).toBe(1);
  });
});
