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
4. push 到 `main` 後會自動執行 `.github/workflows/nextjs.yml`（相容檔 `.github/workflows/deploy-gh-pages.yml` 也已提供）
5. 網址會是 `https://<user>.github.io/<repo>/`

> 頁面底部會顯示目前版本與建置時間（Build: vxxxxxxx · YYYY-MM-DDTHH:mm:ssZ），方便確認 PR 是否已上版。

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

> 若未設定 `NEXT_PUBLIC_FIREBASE_*`，系統會自動以「僅本機模式」運作（可匯入到 localStorage，但不啟用 Google/Firebase 同步），避免 GitHub Pages build 失敗。

## 題庫匯入驗證（本地）
Admin 頁支援「貼上 JSON / 拖曳檔案 / 選擇檔案」三種匯入方式。
Admin 篩選已支援 Chapter 搜尋與 Domain 快速篩選（D1~D20）。
```bash
npm run import:questions -- data/sample-questions.json
```

## 匯入題庫格式（完整）
目前支援三種格式：

1. **Full 格式**：直接提供 `Question[]`（需含完整欄位，如 `id/chapter/domain/options/correctAnswer/explanation/...`）。
2. **Simple-v1 格式（精簡）**：`format: "simple-v1"`，只要提供「第 n 章、題目、選項、答案、說明」，其餘欄位可選填。
3. **Simple-v2-blueprint 格式（推薦）**：`format: "simple-v2-blueprint"`，可攜帶章節、domain/subdomain 編碼、分類方法與信心度等藍圖資訊。

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

### Simple-v2-blueprint JSON 結構（推薦）
```json
{
  "format": "simple-v2-blueprint",
  "sourceExam": "EC-Council CCT 212-82",
  "classificationReference": "CCTv1-Exam-Blueprint",
  "questions": [
    {
      "questionNo": 1,
      "chapterNo": 1,
      "domainCode": "1",
      "domain": "Information Security Threats and Attacks",
      "subdomainCode": "1.2",
      "subdomain": "Information Security Attacks",
      "question": "題目文字",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": "A",
      "explanation": "詳解",
      "questionType": "theory",
      "difficulty": "medium",
      "keywords": ["sql injection"],
      "tags": ["chapter-1", "domain-information-security-threats-and-attacks", "subdomain-1.2"],
      "sourceType": "original",
      "classificationMethod": "blueprint_inference_from_question_text",
      "classificationConfidence": "high"
    }
  ]
}
```

> 匯入後資料會保存到瀏覽器 `localStorage`（key: `cct_question_bank_v1`），Chapter Practice / Exam Mode 會直接讀取此題庫。


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



## localStorage 與 Firebase 同步策略（Google 登入後）
目前採用「**離線優先 + 可手動同步**」：

1. 匯入題庫先寫入本機 `localStorage`（`cct_question_bank_v1`）
2. 使用者 Google 登入後，可在 Admin 點「同步到 Firebase」把本機題庫上傳到 `users/{uid}.questionBank`
3. 也可點「從 Firebase 拉取」覆蓋本機題庫
4. 下次登入時，系統會自動嘗試從 Firebase 拉取題庫

> 若未登入，系統仍可用 localStorage 正常運作（GitHub Pages 靜態版可用）。


## Firebase 最基本安全設定（建議上線前完成）

### 1) Authentication
- 啟用 **Google Sign-in**（Authentication → Sign-in method）
- 在 Authentication 設定中加入允許網域（至少包含 `localhost` 與你的 `*.github.io`）

### 2) Firestore Security Rules
本專案已提供最小可用規則：
- `users/{userId}` 只能本人或 admin 讀寫
- `questions/generatedQuestions` 一般使用者只能讀，只有 admin 可寫
- `practiceAttempts/wrongAnswers` 僅本人可讀寫

部署：
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 3) API Key 與前端環境變數觀念
- `NEXT_PUBLIC_FIREBASE_*` 會被打包到前端（不是秘密）
- 真正安全性依賴 **Auth + Firestore Rules**，不是把 API key 藏在前端
- 請在 Google Cloud Console 對 Web API Key 做 referrer 限制（你的正式網域）

### 4) Admin 權限（進階但建議）
- 使用 Firebase custom claims 設定 admin 使用者
- 讓題庫寫入能力只給 admin（對應 `isAdmin()` 規則）

## 如何讓此系統接上 Firebase（最短路徑）

### Step A：建立 Firebase 專案
1. 建立 Firebase Project
2. 啟用 Firestore（Native mode）
3. 啟用 Authentication（Google）
4. 建立 Web App，取得 config 值

### Step B：本機開發接線
建立 `.env.local`：
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```
`lib/firebase/client.ts` 會自動讀取以上值初始化 Firebase。
### Step C：部署到 GitHub Pages 時的 env
- 到 GitHub repo → Settings → Secrets and variables → Actions
- 建立同名 secrets（`NEXT_PUBLIC_FIREBASE_*`）
- 在 workflow 的 build step 以 `env:` 注入後執行 `npm run build`


#### GitHub Actions Secrets 參數範本（可直接照填）
請到 `Repo Settings -> Secrets and variables -> Actions` 建立以下 secrets：

| Secret 名稱 | 範例值 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyxxxxxxxxxxxxxxxxxxxx` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `your-project-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:123456789012:web:abc123def456` |

Workflow build step 可直接使用：
```yaml
- name: Build with Next.js
  run: npm run build
  env:
    NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.NEXT_PUBLIC_FIREBASE_API_KEY }}
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }}
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }}
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
    NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_APP_ID }}
```



### Admin 內建 Firebase 設定畫面（方便快速測試）
若你不想每次重建部署，也可在 Admin 頁展開「Firebase 設定」：
- 填入 `apiKey/authDomain/projectId/storageBucket/messagingSenderId/appId`
- 點「儲存設定到瀏覽器」後，設定會記在 localStorage（僅此瀏覽器）
- 重新整理後即可啟用 Google 登入與同步功能
- 可用「清除瀏覽器設定」移除

> 建議正式環境仍以 GitHub Secrets + build-time env 為主；Admin 設定畫面適合 demo/驗證使用。


### 為什麼我在 GitHub 有填 Secrets，前端仍顯示 Firebase 未設定？
常見原因是你把值放在 **Environment secrets**，但 build job 用到的是另一個 environment 名稱。

本專案目前 build job 會使用：
- `environment: ${{ vars.FIREBASE_ENVIRONMENT || 'github-pages' }}`

也就是說：
1. 若你沒設定 `FIREBASE_ENVIRONMENT`（Repository Variable），預設會讀 `github-pages` 這個 environment 的 secrets。
2. 若你有設定 `FIREBASE_ENVIRONMENT=production`，就會改讀 `production` 這個 environment 的 secrets。
3. 你也可以直接改用 **Repository secrets / variables**（不依賴 environment），workflow 一樣會讀。

workflow 取值優先順序：
- `secrets.NEXT_PUBLIC_FIREBASE_*`
- 若沒有，再讀 `vars.NEXT_PUBLIC_FIREBASE_*`

> 常見誤區：把 `FIREBASE_ENVIRONMENT` 當成「Environment 名稱」去建立一個 environment。  
> `FIREBASE_ENVIRONMENT` 應該是 **Repository Variable**（值例如 `github-pages` 或 `production`），不是 secret 名稱。

#### 一步一步設定（照做即可）
1. 打開 `Repo Settings -> Secrets and variables -> Actions -> Variables`。  
2. 新增 **Repository Variable**：`FIREBASE_ENVIRONMENT`，值填你想給 build 用的 environment 名稱（例如：`github-pages`）。  
3. 打開 `Repo Settings -> Environments -> <你的環境名稱> -> Environment secrets`，建立以下 6 個 key：  
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. 重新執行 GitHub Actions 的 deploy workflow（或 push 一次）。  
5. 部署完成後打開 `/admin`，確認狀態不再顯示「Firebase 未設定（NEXT_PUBLIC_FIREBASE_* 未注入）」。

### Google 登入按鈕沒有反應？
先釐清：**Google 登入不是必填**。  
不登入也可以匯入題庫、章節練習、正式模擬考、錯題本與歷史分析；只有要做 Firebase 同步時才需要登入。

若 Admin 顯示「Firebase 未設定（NEXT_PUBLIC_FIREBASE_* 未注入）」，代表目前是本機模式：
- Google 登入 / 同步到 Firebase / 從 Firebase 拉取 會被停用
- 先設定 `.env.local`（本機）或 GitHub Actions Secrets（部署）後，重新 build 即可啟用

若 console 顯示 `auth/unauthorized-domain`：
1. 打開 Firebase Console → Authentication → Settings → Authorized domains
2. 加入你的站點網域（例如 `justinchangtw.github.io`）
3. 儲存後重新整理頁面再試一次 Google 登入

若你「明明有加網域但還是不行」，再檢查：
1. Firebase 專案是否正確（不要加到另一個 Firebase project）
2. Authentication → Sign-in method 裡的 Google provider 是否已啟用
3. Admin 頁面顯示的 hostname 是否就是你在 Authorized domains 加入的值（只填網域，不含 `https://` 與路徑）
4. 修改後是否已重新整理頁面（必要時清除瀏覽器快取後再試）

### Step D：題庫同步流程（本專案已實作）
- Admin 匯入 → 存到 localStorage
- Google 登入後可按「同步到 Firebase」上傳到 `users/{uid}.questionBank`
- 可按「從 Firebase 拉取」覆蓋本機題庫

### 是否一定要 Google 登入？
- **本機練習（不用雲端）**：不需要登入。
- **要把資料回寫到 Firebase / 跨裝置同步（手機也讀得到）**：不一定要 Google。系統可用 Firebase Anonymous Auth 自動建立 `users/{uid}`。

### 不用 Google 也可同步 Firebase（Anonymous Auth）
若你不想讓使用者登入 Google，請在 Firebase Console：
1. Authentication → Sign-in method → 啟用 **Anonymous**
2. Firestore 規則維持 `request.auth != null`（匿名登入也有 `auth.uid`）
3. Admin 可按「匿名連線 Firebase（免 Google）」；或直接按同步鈕，系統會自動嘗試匿名登入

### 為什麼「看起來有按同步」但 Firebase 沒資料？
常見原因：
1. **Firebase Anonymous 尚未啟用**：會出現 `auth-failed` 或 `auth/operation-not-allowed`
2. **Firestore 權限拒絕**：會出現 `cloud-write-failed | permission-denied`
3. **讀錯使用者路徑**：本專案資料寫在 `users/{uid}`；若換了登入身份（含匿名 uid 變更）會看到不同資料集
4. **題庫格式無效**：會出現 `invalid-local-bank`（本機資料不符合 schema）

### 全量資料同步（題庫＋歷史＋錯題本＋章節進度）
Admin 已提供：
- 「全量同步到 Firebase」
- 「全量從 Firebase 拉取」

可把以下資料都同步到 Firebase：
- `questionBank`
- `practiceAttempts`
- `wrongNotebook`
- `chapterProgress`

### Step E：驗證
1. 登入 Google
2. 匯入題庫 JSON
3. 點「同步到 Firebase」
4. 重新整理或換瀏覽器後，登入並點「從 Firebase 拉取」確認題目仍在

<<<<<<< codex/create-cct-practice-web-app-specifications-9sbt25
### 快速測通（建議）
若你覺得手動測試步驟太多，可到 Admin 按：
- `快速測通（自動檢查）`

它會一次檢查：
1. localStorage 可用
2. Firebase 設定是否存在
3. Firebase 身份（既有 / 匿名）
4. 全量同步到 Firebase
5. 全量從 Firebase 拉取

結果會同時出現在：
- 畫面結果文字（✅/❌）
- 瀏覽器 console（`console.table`）

=======
>>>>>>> main
## Merge 前自動檢查（建議必開）
- Workflow: `.github/workflows/pr-check.yml`
- 觸發時機：PR 到 `main`
- 檢查項目：`typecheck`、`lint`、`test`、`build`
- 建議在 GitHub Repo Settings → Branch protection rules 將 `PR Quality Gate / Build / Test / Typecheck / Lint` 設為 Required status check，未通過不可合併。
