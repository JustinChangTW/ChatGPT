import { describe, expect, it } from 'vitest';
import { resetLearningProgress } from '../lib/services/learning-progress-storage';

describe('resetLearningProgress', () => {
  it('removes only progress keys', () => {
    localStorage.setItem('cct_practice_history_v1', '[]');
    localStorage.setItem('cct_wrong_notebook_v1', '[]');
    localStorage.setItem('cct_question_bank_v1', '[1]');

    const res = resetLearningProgress();

    expect(res.removed).toContain('cct_practice_history_v1');
    expect(res.removed).toContain('cct_wrong_notebook_v1');
    expect(localStorage.getItem('cct_practice_history_v1')).toBeNull();
    expect(localStorage.getItem('cct_wrong_notebook_v1')).toBeNull();
    expect(localStorage.getItem('cct_question_bank_v1')).toBe('[1]');
  });
});

