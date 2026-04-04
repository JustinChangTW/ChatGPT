# CLAUDE.md (for Codex compatibility)

雖然檔名叫 CLAUDE，本 repo 將此檔視為**給 Codex 的補充指令**。

## Codex 工作風格
- 優先 patch 既有檔案，不先大改架構。
- 對使用者回饋要做「可見結果」：不只改底層，也要在頁面看得到。
- 需求若含權限，至少檢查：
  - Admin UI
  - Firestore rules
  - 對應 service 層

## 常用定位
- 管理台：`app/admin/page.tsx`
- 章節練習（筆記來源）：`app/practice/chapter/page.tsx`
- 錯題本（筆記展示）：`app/wrong-notebook/page.tsx`
- 同步與資料層：`lib/services/*`

## 禁止事項
- 不要宣稱「已測過」但沒跑命令。
- 不要只改文案卻忽略實際資料流。
