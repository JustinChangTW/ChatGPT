# CLAUDE.md

# Project instructions

## Scope
- 這是一個 Next.js 題庫練習網站
- 使用 Firebase 做登入與資料儲存
- 使用 GitHub Pages 做部署
- 目前重點功能包含題庫匯入、同步、診斷與練習流程

## Working style
- 優先做最小改動
- 保留既有行為與資料格式相容性
- 不要因為重構而擴大修改範圍
- 不要自行更換部署方式或後端方案

## Sensitive areas
- Firebase 設定與環境變數
- 題庫 JSON schema 與匯入流程
- GitHub Actions / GitHub Pages 部署
- Firestore 讀寫與診斷流程

## Rules
- 修改題庫格式時，必須同步檢查匯入器、驗證器、顯示邏輯與文件
- 修改 Firebase 邏輯時，必須同時考慮：
  - 設定是否存在
  - 寫入是否成功
  - 讀回是否成功
  - 失敗時錯誤是否清楚
- 保留診斷流程中的成功 / 失敗訊息，不要移除可觀測性
- 不要自創題目資料，題庫資料要盡量忠於來源

## Preferred workflow
1. 先閱讀目標檔案與相鄰邏輯
2. 只修改必要檔案
3. 完成後檢查 build 與受影響功能
4. 回報變更、測試與風險

## Response style
請回報：
- 修改了哪些檔案
- 修改目的
- 驗證方式
- 尚未驗證的風險

## Avoid
- 不要大規模改名
- 不要新增非必要依賴
- 不要任意改動 secrets / workflows / rules
- 不要破壞既有匯入格式相容性
- 不要把 timeout 問題只用拉長時間掩蓋
