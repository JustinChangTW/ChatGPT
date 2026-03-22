import { readFile } from 'node:fs/promises';
import { validateQuestionImport } from '@/lib/services/question-import-service';

async function main() {
  const file = process.argv[2] ?? 'data/sample-questions.json';
  const raw = await readFile(file, 'utf-8');
  const parsed = JSON.parse(raw);
  const result = validateQuestionImport(parsed);
  if (!result.ok) {
    console.error('Import failed:', result.errors);
    process.exit(1);
  }
  console.log(`Import validated: ${result.questions.length} questions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
