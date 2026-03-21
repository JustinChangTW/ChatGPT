import { ZodError } from 'zod';
import { questionImportSchema, Question } from '@/lib/schemas/question';

export function validateQuestionImport(input: unknown):
  | { ok: true; questions: Question[] }
  | { ok: false; errors: string[] } {
  try {
    const parsed = questionImportSchema.parse(input);
    return { ok: true, questions: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        errors: err.errors.map((e) => `${e.path.join('.')} - ${e.message}`)
      };
    }
    return { ok: false, errors: ['Unknown import error'] };
  }
}
