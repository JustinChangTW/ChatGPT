import { NextRequest, NextResponse } from 'next/server';
import { validateQuestionImport } from '@/lib/services/question-import-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = validateQuestionImport(body.questions);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 400 });
  }
  return NextResponse.json({ ok: true, importedCount: validated.questions.length });
}
