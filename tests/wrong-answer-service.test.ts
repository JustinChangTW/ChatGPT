import { describe, expect, it } from 'vitest';
import { updateWrongAnswerEntry } from '../lib/services/wrong-answer-service';

describe('updateWrongAnswerEntry', () => {
  it('marks mastered after 3 consecutive corrects', () => {
    let row = updateWrongAnswerEntry(null, {
      id: 'wa1', userId: 'u1', questionId: 'q1', isCorrect: true, selectedAnswer: 'A', nowISO: '2026-03-21T00:00:00.000Z'
    });
    row = updateWrongAnswerEntry(row, {
      id: 'wa1', userId: 'u1', questionId: 'q1', isCorrect: true, selectedAnswer: 'A', nowISO: '2026-03-21T00:01:00.000Z'
    });
    row = updateWrongAnswerEntry(row, {
      id: 'wa1', userId: 'u1', questionId: 'q1', isCorrect: true, selectedAnswer: 'A', nowISO: '2026-03-21T00:02:00.000Z'
    });
    expect(row.mastered).toBe(true);
  });
});
