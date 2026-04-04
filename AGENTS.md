# AGENTS.md (for Codex)

本檔**專門給 Codex 代理**在此 repo 工作時使用。

## Scope
- 本檔作用範圍：整個 repository。
- 若子目錄有更深層 `AGENTS.md`，以更深層為準。

## 任務執行規範（Codex 必遵守）
1. 先最小修正，再擴大重構。
2. 任何 UI 行為改動，需補 `npm run -s lint` 驗證。
3. 若 `npm run -s typecheck` 失敗，回報「是否為既有問題」與錯誤檔案。
4. 權限邏輯一律走 `lib/services/*`，不要只在 UI 隱藏按鈕。
5. 筆記功能需同時考慮：
   - 共編筆記（shared）
   - 私人筆記（private）

## 回覆格式（Codex）
- Summary：改了哪些檔、目的。
- Testing：列出執行命令與結果。
- 已知問題：若有 blocker 必須明講。
