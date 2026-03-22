import { Question } from '@/lib/schemas/question';
import { MockQuestionGenerator } from '@/lib/services/mock-question-generator';

export const EXAM_BLUEPRINT = [
  { domain: 'Information Security Threats and Attacks', weight: 11 },
  { domain: 'Network Security', weight: 7 },
  { domain: 'Network Security Controls', weight: 23 },
  { domain: 'Application Security and Cloud Computing', weight: 9 },
  { domain: 'Wireless Device Security', weight: 11 },
  { domain: 'Data Security', weight: 10 },
  { domain: 'Network Monitoring and Analysis', weight: 16 },
  { domain: 'Incident and Risk Management', weight: 13 }
] as const;

const TOTAL = 60;
const THEORY_TOTAL = 50;
const PRACTICAL_TOTAL = 10;

export function allocateByWeight(total: number, weights: number[]): number[] {
  const raw = weights.map((w) => (w / 100) * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const ranked = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let idx = 0; idx < ranked.length && remainder > 0; idx += 1) {
    floors[ranked[idx].i] += 1;
    remainder -= 1;
  }

  return floors;
}

export async function assembleOfficialExam(questions: Question[]): Promise<Question[]> {
  const weights = EXAM_BLUEPRINT.map((x) => x.weight);
  const perDomainTotal = allocateByWeight(TOTAL, weights);
  const perDomainTheory = allocateByWeight(THEORY_TOTAL, weights);
  const perDomainPractical = perDomainTotal.map((v, i) => v - perDomainTheory[i]);

  const generator = new MockQuestionGenerator();
  const assembled: Question[] = [];

  for (let i = 0; i < EXAM_BLUEPRINT.length; i += 1) {
    const { domain } = EXAM_BLUEPRINT[i];
    const theoryPool = questions.filter((q) => q.domain === domain && q.questionType === 'theory');
    const practicalPool = questions.filter((q) => q.domain === domain && q.questionType === 'practical');

    const needTheory = perDomainTheory[i];
    const needPractical = perDomainPractical[i];

    assembled.push(...theoryPool.slice(0, needTheory));
    assembled.push(...practicalPool.slice(0, needPractical));

    if (theoryPool.length < needTheory) {
      assembled.push(
        ...(await generator.generate({
          domain,
          chapter: domain,
          questionType: 'theory',
          difficulty: 'medium',
          amount: needTheory - theoryPool.length
        }))
      );
    }

    if (practicalPool.length < needPractical) {
      assembled.push(
        ...(await generator.generate({
          domain,
          chapter: domain,
          questionType: 'practical',
          difficulty: 'medium',
          amount: needPractical - practicalPool.length
        }))
      );
    }
  }

  return assembled.slice(0, TOTAL);
}

export async function assembleChapterPractice(questions: Question[], chapter: string): Promise<Question[]> {
  const pool = questions.filter((q) => q.chapter === chapter);
  const selected = pool.slice(0, 10);

  if (selected.length >= 10) return selected;

  const generator = new MockQuestionGenerator();
  const padding = await generator.generate({
    domain: chapter,
    chapter,
    questionType: 'theory',
    difficulty: 'medium',
    amount: 10 - selected.length
  });

  return [...selected, ...padding];
}
