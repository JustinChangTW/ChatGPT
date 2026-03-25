import { create } from 'zustand';
import { Question } from '@/lib/schemas/question';

type AnswerValue = string | string[];

type PracticeState = {
  sessionId: string | null;
  questions: Question[];
  answers: Record<string, AnswerValue>;
  currentIndex: number;
  startedAt: string | null;
  setSession: (input: { sessionId: string; questions: Question[] }) => void;
  setAnswer: (questionId: string, answer: AnswerValue) => void;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
};

export const usePracticeStore = create<PracticeState>((set) => ({
  sessionId: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  startedAt: null,
  setSession: ({ sessionId, questions }) =>
    set({ sessionId, questions, answers: {}, currentIndex: 0, startedAt: new Date().toISOString() }),
  setAnswer: (questionId, answer) => set((s) => ({ answers: { ...s.answers, [questionId]: answer } })),
  setCurrentIndex: (index) => set((s) => ({ currentIndex: Math.min(Math.max(index, 0), Math.max(s.questions.length - 1, 0)) })),
  next: () => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),
  prev: () => set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),
  reset: () => set({ sessionId: null, questions: [], answers: {}, currentIndex: 0, startedAt: null })
}));
