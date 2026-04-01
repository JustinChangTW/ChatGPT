import { describe, expect, it } from 'vitest';
import { validateQuestionImport } from '../lib/services/question-import-service';

describe('validateQuestionImport simple format', () => {
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

    expect(result.normalizedFrom).toBe('simple-v1');
    expect(result.questions[0].chapter).toBe('第1章');
    expect(result.questions[0].options[0].key).toBe('A');
    expect(result.questions[0].correctAnswer).toBe('A');
  });

  it('accepts simple-v2-blueprint format and maps to full question schema', () => {
    const result = validateQuestionImport({
      format: 'simple-v2-blueprint',
      sourceExam: 'EC-Council CCT 212-82',
      classificationReference: 'CCTv1-Exam-Blueprint',
      questions: [
        {
          questionNo: 1,
          chapterNo: 1,
          domainCode: '1',
          domain: 'Information Security Threats and Attacks',
          subdomainCode: '1.2',
          subdomain: 'Information Security Attacks',
          question: '題目文字',
          options: ['選項A', '選項B', '選項C', '選項D'],
          answer: 'A',
          explanation: '詳解',
          questionType: 'theory',
          difficulty: 'medium',
          keywords: ['sql injection'],
          tags: ['chapter-1'],
          sourceType: 'original',
          classificationMethod: 'blueprint_inference_from_question_text',
          classificationConfidence: 'high'
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.normalizedFrom).toBe('simple-v2-blueprint');
    expect(result.questions[0].chapter).toBe('第1章');
    expect(result.questions[0].domain).toBe('Information Security Threats and Attacks');
    expect(result.questions[0].tags).toContain('domain-1');
    expect(result.questions[0].tags).toContain('subdomain-1.2');
    expect(result.questions[0].tags).toContain('confidence-high');
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
