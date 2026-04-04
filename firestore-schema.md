# Firestore Collections 設計（多人版）

## 角色模型
- `admin`：可匯入題庫、調整系統參數、查看所有使用者作答進度。
- `member`：一般使用者，可作答、寫共編筆記、編輯公共知識庫。
- `guest`：未登入訪客，可讀取公共資料。

## users/{userId}
```ts
{
  role: 'admin' | 'member';
  roleUpdatedAt?: Timestamp;
  personalData?: {
    practiceAttempts?: PracticeAttempt[];
    wrongNotebook?: WrongAnswer[];
    chapterProgress?: ChapterProgressEntry[];
    updatedAt?: Timestamp;
  };
  personalVersion?: number;
  personalUpdatedAt?: Timestamp;
}
```
- 隱私：使用者作答記錄與錯題資料放在 `personalData`，只允許本人與 admin 讀取。

## publicData/cctShared
```ts
{
  questionBank?: Question[];
  questionBankUpdatedAt?: Timestamp;
  questionBankVersion?: number;
}
```
- 僅 admin 可寫（題庫匯入/覆蓋）。

## publicData/cctSharedCommon
```ts
{
  commonData?: {
    knowledgeBase?: CCTKnowledgeItem[];
    vocabularyBank?: VocabularyEntry[];
    customKeywords?: Record<string, DictionaryEntry[]>;
    // 下列欄位只有 admin 會上傳
    questionBank?: Question[];
    dictionaryProviders?: DictionaryProviderConfig[];
    aiParams?: AIParamsConfig;
    updatedAt?: Timestamp;
  };
  version?: number;
  updatedAt?: Timestamp;
}
```
- 公共共編資料池。
- 系統參數（例如 AI params）應由 admin 管理。

## knowledgeBasePublic/{docId}
```ts
{
  entries: CCTKnowledgeItem[];
  updatedAt: Timestamp;
  updatedBy?: string;
}
```
- 公共知識庫共編集合（可依需求後續切分為每章/每主題一份文件）。

## sharedQuestionNotes/{questionId}
```ts
{
  questionId: string;
  content: string;
  updatedAt: Timestamp;
}
```
- 題目共編筆記（全站共享）。

---

## 管理者角色設定教學（你選擇的方案 A）
1. 先登入網站，取得使用者 UID（Firebase Authentication > Users）。
2. 進入 Firestore，建立/編輯文件：`users/{uid}`。
3. 設定欄位：`role = "admin"`。
4. 重新整理前台，admin 權限會生效。

> 一般使用者請設 `role = "member"`。
