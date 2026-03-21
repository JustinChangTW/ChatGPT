# C|CT Practice Web App (GitHub Pages-ready MVP)

## 技術棧
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui 風格元件（本骨架示範基礎 Card，可再接 shadcn CLI）
- Firebase Auth + Firestore（保留介面，GitHub Pages 版先以本地 mock 運作）
- Zod + React Hook Form
- Zustand
- Vitest + Testing Library

## 本機啟動
```bash
npm install
npm run dev
```

## GitHub Pages 部署（重點）
本專案已設定 `output: export`，可直接輸出靜態網站到 `out/`。

1. 將 repo 推到 GitHub 並把預設分支設為 `main`
2. 到 GitHub Repo Settings → Pages
3. Source 選 `GitHub Actions`
4. push 到 `main` 後會自動執行 `.github/workflows/nextjs.yml`
5. 網址會是 `https://<user>.github.io/<repo>/`

> 若 repo 名稱變更，`next.config.mjs` 會依 `GITHUB_REPOSITORY` 自動設定 basePath。

> 若你之後加入 `package-lock.json`，可把 workflow 的 `npm install` 改回 `npm ci` 以獲得更穩定的 CI。

## 環境變數（未來接 Firebase 時）
建立 `.env.local`：
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## 題庫匯入驗證（本地）
```bash
npm run import:questions -- data/sample-questions.json
```

## 匯入題庫格式（完整）
目前支援兩種格式：

1. **Full 格式**：直接提供 `Question[]`（需含完整欄位，如 `id/chapter/domain/options/correctAnswer/explanation/...`）。
2. **Simple 格式（推薦）**：`simple-v1`（`format` 欄位必填且必須為 `simple-v1`），只要提供「第 n 章、題目、選項、答案、說明」，其餘欄位可選填。

### Simple-v1 JSON 結構
```json
{
  "format": "simple-v1",
  "questions": [
    {
      "chapterNo": 1,
      "question": "題目文字",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": "A",
      "explanation": "詳解",
      "domain": "Network Security",
      "subdomain": "Firewall",
      "questionType": "theory",
      "difficulty": "easy",
      "keywords": ["firewall"],
      "tags": ["chapter-1"]
    }
  ]
}
```

### 欄位說明（Simple-v1）
- `chapterNo`：可填 `1` 或 `"第1章"`
- `question`：題目文字
- `options`：可用字串陣列（系統自動轉 A/B/C/D），或 `{ key, text }[]`
- `answer`：正確答案，單選用字串（如 `"A"`），多選可用陣列（如 `["A","C"]`）
- `explanation`：詳解
- `domain/subdomain/questionType/difficulty/keywords/tags`：選填

範例檔：`data/import-template.simple-v1.json`


## 測試
```bash
npm run test
```

## 專案結構重點
- `app/`: 頁面（GitHub Pages 靜態可用）
- `lib/schemas/`: Zod schema / 型別
- `lib/services/`: 組卷、補題、錯題與紀錄邏輯
- `lib/firebase/`: Firebase 初始化（保留）
- `data/`: 範例題庫 JSON
- `tests/`: 核心業務邏輯測試


## Merge 前自動檢查（建議必開）
- Workflow: `.github/workflows/pr-check.yml`
- 觸發時機：PR 到 `main`
- 檢查項目：`typecheck`、`lint`、`test`、`build`
- 建議在 GitHub Repo Settings → Branch protection rules 將 `PR Quality Gate / Build / Test / Typecheck / Lint` 設為 Required status check，未通過不可合併。
