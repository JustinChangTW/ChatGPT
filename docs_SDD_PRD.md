# C|CT 題庫練習 Web App - SDD/PRD

## 1) Product Overview
- 目標：提供 C|CT 考生可持續練習、模擬考、追蹤弱點、管理錯題的平台。
- MVP 範圍：章節練習(10 題)、正式模擬考(60 題)、結果解析、錯題本、歷史紀錄、Admin 匯入。
- 核心差異：題庫不足時可自動補生成同考點題並標記 `sourceType=generated`。

## 2) User Stories
- 作為考生，我要能登入並開始章節練習。
- 作為考生，我要能按官方藍圖完成 60 題模擬考。
- 作為考生，我要看每題詳解並自動累積錯題。
- 作為考生，我要查看歷史趨勢與弱點領域。
- 作為管理員，我要匯入 JSON 題庫並得到 schema 驗證結果。

## 3) Functional Requirements
- Auth：Firebase Authentication（Google / Email 擴充）。
- 題目：支援 `theory`/`practical`、原題/生成題標記。
- 模式 A：章節 10 題，不足補生成。
- 模式 B：正式 60 題，理論 50、實作 10，依藍圖權重近似配題。
- 評分：總分、正確率、領域拆解、每題詳解。
- 錯題本：wrongCount / correctCount / streak / mastered。
- 歷史：practiceAttempts 寫入並可查詢趨勢。
- Admin：JSON 匯入驗證、列表、篩選。

## 4) Non-functional Requirements
- TypeScript strict 模式。
- Zod schema 驗證輸入資料。
- 分層架構（UI / service / data access）。
- 可替換 mock generator 為真實 LLM provider。
- Mobile-first 響應式 UI。

## 5) Data Model
- `questions`: 原題庫。
- `generatedQuestions`: 補生成題。
- `practiceAttempts`: 每次提交結果。
- `wrongAnswers`: 錯題統計。
- `users`: 基本帳號與統計快取。
- `settings`: 系統參數（如時間限制）。

## 6) Page Flow
1. Dashboard → 章節練習 / 模擬考。
2. 開始測驗 → 作答頁（分頁切題）→ 交卷。
3. 結果頁：總結 + 每題解析 + 寫入錯題本。
4. 錯題本：篩選、排序、重新練習。
5. 歷史：按時間檢視每次紀錄與領域趨勢。
6. Admin：匯入/篩選題庫。

## 7) Business Rules
- theory 預設單選；practical 第一版用情境題/步驟判斷題。
- 若題庫不足：先取 `generatedQuestions`，再啟動 `generateQuestionsByBlueprint()`。
- 系統生成題必須帶完整答案、詳解、keywords。

## 8) Exam Assembly Logic
- 總 60 題、理論 50、實作 10。
- 權重：11/7/23/9/11/10/16/13。
- 演算法：
  1) 以 Largest Remainder 分配各領域題數。
  2) 各領域再拆 theory/practical。
  3) 池中不足時補生成。

## 9) Wrong Answer Book Rules
- 答錯：`wrongCount +1`, `streakWrong +1`, `streakCorrect=0`, `mastered=false`。
- 答對：`correctCount +1`, `streakCorrect +1`, `streakWrong=0`。
- 連續三次答對：`mastered=true`。
- 列表可按 `wrongCount desc`。

## 10) Firebase Security Rules 建議
- 使用者只能讀寫自己的 `users/practiceAttempts/wrongAnswers`。
- 題庫寫入僅 admin；一般使用者 read-only。
- settings 僅 admin 可寫。

## 11) Future Enhancements
- 倒數計時 + 自動交卷。
- LLM Provider Adapter（OpenAI/Gemini/Claude）。
- 實作題擴充：拖拉配對、CLI 模擬、Lab sandbox。
- Cloud Functions 批次計算 dashboard 指標。
