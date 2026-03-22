import { describe, expect, it } from 'vitest';
import { validateQuestionImport } from '../lib/services/question-import-service';

describe('validateQuestionImport simple-v1', () => {
  it('accepts required simple-v1 format and maps to full question schema', () => {
    const result = validateQuestionImport({
      format: 'simple-v1',
      questions: [
        {
          chapterNo: 1,
          question: '題目文字',
          options: ['選項A', '選項B', '選項C', '選項D'],
          answer: 'A',
          explanation: '詳解',
          domain: 'Network Security',
          subdomain: 'Firewall',
          questionType: 'theory',
          difficulty: 'medium',
          keywords: ['firewall'],
          tags: ['chapter-1']
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.normalizedFrom).toBe('simple');
    expect(result.questions[0].chapter).toBe('第1章');
    expect(result.questions[0].options[0].key).toBe('A');
    expect(result.questions[0].correctAnswer).toBe('A');
  });

  it('rejects simple payload without format', () => {
    const result = validateQuestionImport({
      questions: [
        {
          chapterNo: 1,
          question: '題目文字',
          options: ['選項A', '選項B'],
          answer: 'A',
          explanation: '詳解'
        }
      ]
    });

    expect(result.ok).toBe(false);
  });
});
