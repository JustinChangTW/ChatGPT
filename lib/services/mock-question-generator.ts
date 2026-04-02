import { Question } from '@/lib/schemas/question';

export type GenerateQuestionInput = {
  domain: string;
  chapter: string;
  questionType: 'theory' | 'practical';
  difficulty: 'easy' | 'medium' | 'hard';
  amount: number;
};

export interface QuestionGenerator {
  generate(input: GenerateQuestionInput): Promise<Question[]>;
}

export class MockQuestionGenerator implements QuestionGenerator {
  async generate(input: GenerateQuestionInput): Promise<Question[]> {
    const now = new Date().toISOString();
    return Array.from({ length: input.amount }).map((_, idx) => ({
      id: `gen-${input.domain}-${Date.now()}-${idx}`,
      chapter: input.chapter,
      domain: input.domain,
      subdomain: `${input.domain}-generated`,
      questionType: input.questionType,
      stem: `[Generated] ${input.domain} ${input.questionType} 題目 #${idx + 1}`,
      options: [
        { key: 'A', text: '選項 A' },
        { key: 'B', text: '選項 B' },
        { key: 'C', text: '選項 C' },
        { key: 'D', text: '選項 D' }
      ],
      correctAnswer: 'A',
      explanation: '此為 mock generator 產生題，未來可換成 LLM。',
      keywords: [input.domain, input.questionType, input.difficulty],
      difficulty: input.difficulty,
      sourceType: 'generated',
      tags: ['mock-generated'],
      createdAt: now,
      updatedAt: now
    }));
  }
}
