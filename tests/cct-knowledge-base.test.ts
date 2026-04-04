import { describe, expect, it } from 'vitest';
import { CCT_KNOWLEDGE_BASE, matchKnowledgeByQuestion, searchKnowledgeItems } from '../lib/knowledge/cct-knowledge-base';
import { Question } from '../lib/schemas/question';

const baseQuestion: Question = {
  id: 'q-1',
  chapter: 'Chapter 1',
  domain: 'Information Security Threats and Attacks',
  subdomain: 'General',
  questionType: 'theory',
  stem: 'What is phishing?',
  options: [
    { key: 'A', text: 'A' },
    { key: 'B', text: 'B' }
  ],
  correctAnswer: 'A',
  explanation: 'test',
  keywords: ['phishing'],
  difficulty: 'easy',
  sourceType: 'original',
  tags: ['chapter-1', 'domain-1', 'phishing'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe('cct knowledge base', () => {
  it('builds 161 knowledge entries to match exam coverage target', () => {
    expect(CCT_KNOWLEDGE_BASE).toHaveLength(161);
  });

  it('supports text search and chapter filtering', () => {
    const found = searchKnowledgeItems({ query: 'siem', chapterNo: 'all' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((x) => x.chapterNo === 7)).toBe(true);
  });

  it('maps questions to related knowledge entries by chapter/tags', () => {
    const matched = matchKnowledgeByQuestion(baseQuestion);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((x) => x.chapterNo === 1)).toBe(true);
  });
});
