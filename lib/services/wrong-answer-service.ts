import { WrongAnswer } from '@/lib/schemas/practice';

export function updateWrongAnswerEntry(
  existing: WrongAnswer | null,
  payload: {
    id: string;
    userId: string;
    questionId: string;
    isCorrect: boolean;
    selectedAnswer: string | string[];
    nowISO: string;
  }
): WrongAnswer {
  const base: WrongAnswer =
    existing ?? {
      id: payload.id,
      userId: payload.userId,
      questionId: payload.questionId,
      wrongCount: 0,
      correctCount: 0,
      streakWrong: 0,
      streakCorrect: 0,
      lastWrongAt: null,
      lastCorrectAt: null,
      mastered: false,
      lastSelectedAnswer: null,
      notes: ''
    };

  if (payload.isCorrect) {
    const streakCorrect = base.streakCorrect + 1;
    return {
      ...base,
      correctCount: base.correctCount + 1,
      streakCorrect,
      streakWrong: 0,
      mastered: streakCorrect >= 3,
      lastCorrectAt: payload.nowISO,
      lastSelectedAnswer: payload.selectedAnswer
    };
  }

  return {
    ...base,
    wrongCount: base.wrongCount + 1,
    streakWrong: base.streakWrong + 1,
    streakCorrect: 0,
    mastered: false,
    lastWrongAt: payload.nowISO,
    lastSelectedAnswer: payload.selectedAnswer
  };
}
