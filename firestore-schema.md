# Firestore Collections 設計

## users/{userId}
```ts
{
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  createdAt: string;
  updatedAt: string;
}
```

## questions/{questionId}
- 參照 `Question` schema（sourceType 固定 original）

## generatedQuestions/{questionId}
- 參照 `Question` schema（sourceType 固定 generated）

## practiceAttempts/{attemptId}
- 參照 `PracticeAttempt` schema
- 查詢：`userId + submittedAt desc`

## wrongAnswers/{userId_questionId}
```ts
{
  id: string;
  userId: string;
  questionId: string;
  wrongCount: number;
  correctCount: number;
  streakWrong: number;
  streakCorrect: number;
  lastWrongAt: string | null;
  lastCorrectAt: string | null;
  mastered: boolean;
  lastSelectedAnswer: string | string[] | null;
  notes: string;
}
```
- 查詢：`userId + wrongCount desc`

## settings/{docId}
```ts
{
  examDurationSeconds?: number;
  chapterPracticeQuestionCount?: number;
  generatorEnabled?: boolean;
}
```
