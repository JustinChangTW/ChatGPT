import { z } from 'zod';

export const questionResultSchema = z.object({
  questionId: z.string(),
  sourceType: z.enum(['original', 'generated']),
  userAnswer: z.union([z.string(), z.array(z.string())]),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  isCorrect: z.boolean(),
  chapter: z.string(),
  domain: z.string(),
  questionType: z.enum(['theory', 'practical'])
});

export const practiceAttemptSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mode: z.enum(['chapter', 'exam']),
  selectedChapter: z.string().optional(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  wrongCount: z.number().int(),
  theoryCorrectCount: z.number().int(),
  practicalCorrectCount: z.number().int(),
  score: z.number(),
  accuracy: z.number(),
  domainBreakdown: z.record(
    z.object({
      total: z.number().int(),
      correct: z.number().int(),
      accuracy: z.number()
    })
  ),
  questionResults: z.array(questionResultSchema),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  durationSeconds: z.number().int()
});

export const wrongAnswerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  questionId: z.string(),
  wrongCount: z.number().int().default(0),
  correctCount: z.number().int().default(0),
  streakWrong: z.number().int().default(0),
  streakCorrect: z.number().int().default(0),
  lastWrongAt: z.string().datetime().nullable(),
  lastCorrectAt: z.string().datetime().nullable(),
  mastered: z.boolean().default(false),
  lastSelectedAnswer: z.union([z.string(), z.array(z.string())]).nullable(),
  notes: z.string().optional().default('')
});

export type PracticeAttempt = z.infer<typeof practiceAttemptSchema>;
export type QuestionResult = z.infer<typeof questionResultSchema>;
export type WrongAnswer = z.infer<typeof wrongAnswerSchema>;
