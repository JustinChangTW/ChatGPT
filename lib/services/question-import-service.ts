import { ZodError, z } from 'zod';
import { questionImportSchema, Question } from '@/lib/schemas/question';

const simpleOptionSchema = z.union([
  z.string().min(1),
  z.object({ key: z.string().min(1), text: z.string().min(1) })
]);

const simpleRowSchema = z.object({
  chapterNo: z.union([z.number().int().positive(), z.string().min(1)]),
  question: z.string().min(1),
  options: z.array(simpleOptionSchema).min(2),
  answer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  explanation: z.string().min(1),
  domain: z.string().optional().default('General'),
  subdomain: z.string().optional().default('General'),
  questionType: z.enum(['theory', 'practical']).optional().default('theory'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  keywords: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([])
});

const simpleImportSchema = z.object({
  format: z.literal('simple-v1'),
  questions: z.array(simpleRowSchema).min(1)
});

const simpleV2BlueprintRowSchema = z.object({
  questionNo: z.union([z.number().int().positive(), z.string().min(1)]),
  chapterNo: z.union([z.number().int().positive(), z.string().min(1)]),
  domainCode: z.string().min(1),
  domain: z.string().min(1),
  subdomainCode: z.string().min(1),
  subdomain: z.string().min(1),
  question: z.string().min(1),
  options: z.array(simpleOptionSchema).min(2),
  answer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  explanation: z.string().min(1),
  questionType: z.enum(['theory', 'practical']).optional().default('theory'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  keywords: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  sourceType: z.enum(['original', 'generated']).optional().default('original'),
  classificationMethod: z.string().optional(),
  classificationConfidence: z.enum(['low', 'medium', 'high']).optional()
});

const simpleV2BlueprintImportSchema = z.object({
  format: z.literal('simple-v2-blueprint'),
  sourceExam: z.string().min(1),
  classificationReference: z.string().min(1),
  questions: z.array(simpleV2BlueprintRowSchema).min(1)
});

type SimpleRow = z.infer<typeof simpleRowSchema>;
type SimpleV2BlueprintRow = z.infer<typeof simpleV2BlueprintRowSchema>;

function normalizeChapter(chapterNo: string | number): string {
  if (typeof chapterNo === 'number') return `第${chapterNo}章`;
  return chapterNo.startsWith('第') ? chapterNo : `第${chapterNo}章`;
}

function toOptionObjects(options: SimpleRow['options']): { key: string; text: string }[] {
  return options.map((opt, idx) => {
    if (typeof opt === 'string') {
      return { key: String.fromCharCode(65 + idx), text: opt };
    }
    return opt;
  });
}

function toQuestion(row: SimpleRow, index: number): Question {
  const now = new Date().toISOString();
  const chapter = normalizeChapter(row.chapterNo);

  return {
    id: `import-${Date.now()}-${index}`,
    chapter,
    domain: row.domain ?? 'General',
    subdomain: row.subdomain ?? 'General',
    questionType: row.questionType ?? 'theory',
    stem: row.question,
    options: toOptionObjects(row.options),
    correctAnswer: row.answer,
    explanation: row.explanation,
    keywords: row.keywords && row.keywords.length > 0 ? row.keywords : [chapter, row.domain ?? 'General'],
    difficulty: row.difficulty ?? 'medium',
    sourceType: 'original',
    tags: row.tags ?? [],
    createdAt: now,
    updatedAt: now
  };
}

function toQuestionFromBlueprint(row: SimpleV2BlueprintRow, index: number): Question {
  const now = new Date().toISOString();
  const chapter = normalizeChapter(row.chapterNo);

  return {
    id: `import-v2-${Date.now()}-${String(row.questionNo)}-${index}`,
    chapter,
    domain: row.domain,
    subdomain: row.subdomain,
    questionType: row.questionType ?? 'theory',
    stem: row.question,
    options: toOptionObjects(row.options),
    correctAnswer: row.answer,
    explanation: row.explanation,
    keywords:
      row.keywords && row.keywords.length > 0
        ? row.keywords
        : [chapter, `domain-${row.domainCode}`, `subdomain-${row.subdomainCode}`],
    difficulty: row.difficulty ?? 'medium',
    sourceType: row.sourceType ?? 'original',
    tags: [
      ...(row.tags ?? []),
      `domain-${row.domainCode}`,
      `subdomain-${row.subdomainCode}`,
      ...(row.classificationMethod ? [`classification-${row.classificationMethod}`] : []),
      ...(row.classificationConfidence ? [`confidence-${row.classificationConfidence}`] : [])
    ],
    createdAt: now,
    updatedAt: now
  };
}

export function validateQuestionImport(input: unknown):
  | { ok: true; questions: Question[]; normalizedFrom: 'full' | 'simple-v1' | 'simple-v2-blueprint' }
  | { ok: false; errors: string[] } {
  try {
    const parsed = questionImportSchema.parse(input);
    return { ok: true, questions: parsed, normalizedFrom: 'full' };
  } catch {
    try {
      const parsedSimple = simpleImportSchema.parse(input);
      const mapped = parsedSimple.questions.map(toQuestion);
      const verified = questionImportSchema.parse(mapped);
      return { ok: true, questions: verified, normalizedFrom: 'simple-v1' };
    } catch (simpleV1Err) {
      try {
        const parsedSimpleV2 = simpleV2BlueprintImportSchema.parse(input);
        const mapped = parsedSimpleV2.questions.map(toQuestionFromBlueprint);
        const verified = questionImportSchema.parse(mapped);
        return { ok: true, questions: verified, normalizedFrom: 'simple-v2-blueprint' };
      } catch (simpleV2Err) {
        const zerr = simpleV2Err instanceof ZodError ? simpleV2Err : simpleV1Err;
        if (zerr instanceof ZodError) {
          return {
            ok: false,
            errors: zerr.errors.map((e) => `${e.path.join('.')} - ${e.message}`)
          };
        }
        return { ok: false, errors: ['Unknown import error'] };
      }
    }
  }
}
