# CLAUDE.md

本檔是給 Claude/LLM 類代理在本專案協作時的執行準則。

## 工作模式
- 先讀需求再改碼，避免大範圍重構。
- 優先最小可驗證修正（small, testable patch）。
- 畫面問題先定位到頁面元件，資料問題先定位到 `lib/services`。

## 專案重點路徑
- `app/admin/page.tsx`：管理台（匯入、同步、權限提示）
- `app/practice/chapter/page.tsx`：逐題/清單練習、筆記
- `app/exam/page.tsx`：試券與作答紀錄
- `app/wrong-notebook/page.tsx`：錯題分析與筆記查看
- `lib/services/*`：資料層（同步、筆記、設定、儲存）

## 常見地雷
- 只改 UI 不改資料層，容易造成「看得到按鈕但沒儲存」。
- 只改 local state 不做 persistence，重新整理即遺失。
- 改權限但沒更新提示文案，使用者不知道為何按鈕不能用。

## 建議輸出
- 提供「做了什麼」「為什麼」「如何驗證」三段式摘要。
- 明確列出已知未解（例如 typecheck 受既有測試 fixture 影響）。
