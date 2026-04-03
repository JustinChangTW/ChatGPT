import { PracticeAttempt, QuestionResult } from '@/lib/schemas/practice';

export function buildPracticeAttempt(input: {
  id: string;
  userId: string;
  mode: 'chapter' | 'exam';
  selectedChapter?: string;
  questionResults: QuestionResult[];
  startedAt: string;
  submittedAt: string;
}): PracticeAttempt {
  const totalQuestions = input.questionResults.length;
  const correctCount = input.questionResults.filter((x) => x.isCorrect).length;
  const wrongCount = totalQuestions - correctCount;
  const theoryCorrectCount = input.questionResults.filter(
    (x) => x.questionType === 'theory' && x.isCorrect
  ).length;
  const practicalCorrectCount = input.questionResults.filter(
    (x) => x.questionType === 'practical' && x.isCorrect
  ).length;

  const domainBreakdown = input.questionResults.reduce<PracticeAttempt['domainBreakdown']>((acc, item) => {
    if (!acc[item.domain]) {
      acc[item.domain] = { total: 0, correct: 0, accuracy: 0 };
    }
    acc[item.domain].total += 1;
    if (item.isCorrect) acc[item.domain].correct += 1;
    acc[item.domain].accuracy = Number(
      ((acc[item.domain].correct / acc[item.domain].total) * 100).toFixed(2)
    );
    return acc;
  }, {});

  const durationSeconds = Math.floor(
    (new Date(input.submittedAt).getTime() - new Date(input.startedAt).getTime()) / 1000
  );

  return {
    id: input.id,
    userId: input.userId,
    mode: input.mode,
    selectedChapter: input.selectedChapter,
    totalQuestions,
    correctCount,
    wrongCount,
    theoryCorrectCount,
    practicalCorrectCount,
    score: Number(((correctCount / totalQuestions) * 100).toFixed(2)),
    accuracy: Number(((correctCount / totalQuestions) * 100).toFixed(2)),
    domainBreakdown,
    questionResults: input.questionResults,
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    durationSeconds
  };
}
