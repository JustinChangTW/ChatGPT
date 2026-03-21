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
4. push 到 `main` 後會自動執行 `.github/workflows/deploy-gh-pages.yml`
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
