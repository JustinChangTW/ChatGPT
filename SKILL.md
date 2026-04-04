# SKILL.md

## Name
question-bank-web-maintenance

## Purpose
在此專案中安全地修改題庫練習網站，特別是以下領域：
- 題庫 JSON 匯入
- chapter / domain / subdomain 對應
- Firebase 同步
- 診斷流程
- GitHub Pages 相容性

## When to use this skill
當任務涉及以下任一項時套用本技能：
- 匯入題庫 JSON 或調整 schema
- 修正 Firebase 初始化、登入、讀寫、同步
- 修改診斷按鈕、快速測通、全量同步、回讀檢查
- 修正 Next.js / GitHub Pages 部署相關行為
- 修正題庫顯示、章節分類、錯題本資料流

## Inputs to inspect first
- `README.md`
- Firebase 初始化與設定讀取位置
- 題庫匯入頁面 / parser / validator
- 診斷或 quick check 邏輯
- GitHub Pages workflow 與部署相關設定（若任務直接涉及部署）

## Constraints
- 優先最小改動
- 維持既有匯入格式相容性
- 維持 Firebase collection / path / env 名稱穩定
- 不隨意調整部署策略
- 不自創題目內容
- 不破壞 diagnostics 的可觀測性

## Recommended process

### 1. Understand the target path
先確認任務落在哪一類：
- UI 顯示
- 題庫 schema
- Firebase 行為
- 部署 / 環境設定
- 診斷流程

### 2. Trace the full flow before editing
如果改的是：
- 題庫匯入：追 parser → validator → import action → Firebase write → UI result
- Firebase：追 config → auth → write → readback → diagnostics
- 題目分類：追 schema → filters → chapter/domain UI → statistics

### 3. Make the smallest viable change
- 優先補洞，不先重寫
- 優先延續既有命名與結構
- 只有在現有結構明顯阻礙任務時才抽象化

### 4. Validate the change
至少確認：
- 修改路徑可正常載入
- 匯入資料格式仍可被接受
- Firebase 路徑沒有被破壞
- 錯誤訊息仍可協助定位問題

### 5. Report clearly
輸出時要說明：
- 改了哪些檔案
- 改了什麼
- 怎麼驗證
- 哪些部分尚未驗證

## Checklists

### A. 題庫匯入相關
- [ ] JSON schema 與 UI 說明一致
- [ ] answer / options / difficulty / questionType enum 一致
- [ ] chapter / domain / subdomain 可被系統判讀
- [ ] explanation 沒有被遺失
- [ ] 匯入成功 / 失敗訊息清楚

### B. Firebase 相關
- [ ] config 來源清楚
- [ ] auth 成功路徑不受影響
- [ ] 寫入後可讀回
- [ ] timeout / error 有清楚訊息
- [ ] 不偷改 env 名稱

### C. GitHub Pages / build 相關
- [ ] 仍可 build
- [ ] 靜態資源路徑不被破壞
- [ ] workflow 變更有明確理由
- [ ] 不把 secrets 寫死進程式碼

## Anti-patterns
- 只改 parser，不改 validator
- 只改前端欄位，不改實際寫入結構
- 為了快速通過而關掉錯誤處理
- 將 Firebase 失敗改成靜默失敗
- 用新格式覆蓋舊格式但不保留相容性

## Example task framing
「請修正題庫匯入失敗」
- 先檢查 schema 與 validator
- 再檢查實際匯入 JSON 欄位
- 最後檢查錯誤訊息是否能指出問題欄位

「請修正 Firebase 快速測通 timeout」
- 先確認 config / auth
- 再確認 write path
- 再確認 readback 與 timeout 點
- 不要只把 timeout 拉長而不追原因
