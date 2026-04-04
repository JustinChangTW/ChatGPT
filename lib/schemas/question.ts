import { z } from 'zod';

export const optionSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1)
});

export const questionSchema = z.object({
  id: z.string().min(1),
  chapter: z.string().min(1),
  domain: z.string().min(1),
  subdomain: z.string().min(1),
  questionType: z.enum(['theory', 'practical']),
  stem: z.string().min(1),
  options: z.array(optionSchema).min(2),
  correctAnswer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  explanation: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  sourceType: z.enum(['original', 'generated']),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const questionImportSchema = z.array(questionSchema);

export type Question = z.infer<typeof questionSchema>;
