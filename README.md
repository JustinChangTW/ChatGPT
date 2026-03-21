# C|CT Practice Web App (MVP Skeleton)

## 技術棧
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui 風格元件（本骨架示範基礎 Card，可再接 shadcn CLI）
- Firebase Auth + Firestore + Hosting
- Zod + React Hook Form
- Zustand
- Vitest + Testing Library

## 本機啟動
```bash
npm install
npm run dev
```

## 環境變數
建立 `.env.local`：
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## 題庫匯入驗證
```bash
npm run import:questions -- data/sample-questions.json
```

## 測試
```bash
npm run test
```

## Firebase 設定
```bash
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

## Hosting 部署
> 建議使用 SSR 版 Hosting + App Hosting；本 MVP 先示範靜態 hosting 設定。
```bash
npm run build
firebase deploy --only hosting
```

## 專案結構重點
- `app/`: 頁面與 API route
- `lib/schemas/`: Zod schema / 型別
- `lib/services/`: 組卷、補題、錯題與紀錄邏輯
- `lib/firebase/`: Firebase 初始化
- `data/`: 範例題庫 JSON
- `tests/`: 核心業務邏輯測試
