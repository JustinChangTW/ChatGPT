# SKILL.md

此專案的實作技能包（Project Skill Pack）。

## Skill A：Notebook 雙軌（共編 + 私人）
### 目的
確保筆記同時支援：
- 共享知識（共編）
- 個人反思（私人）

### 實作要點
- 共編：走雲端服務（`shared-question-notes`）。
- 私人：走 user-scope local storage（`private-question-notes`）。
- 章節練習頁提供兩顆按鈕：
  - 儲存私人筆記
  - 儲存共編筆記
- 錯題本需可讀取兩種筆記並明確標示。

## Skill B：Exam 可追溯紀錄
### 目的
避免「有作答但歷史空白」。

### 實作要點
- 產生試券時就建立草稿紀錄。
- 作答過程持續 upsert 同一筆試券 id。
- 交卷後覆寫為最終結果。

## Skill C：Admin 權限可操作
### 目的
讓管理者設定流程可被一般人順利完成。

### 實作要點
- UI 顯示目前登入 UID。
- 支援一鍵複製 UID 與 `users/{uid}` 路徑。
- 提供角色設定教學（member/admin）。
