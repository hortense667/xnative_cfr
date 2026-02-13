# Railway で xnative_cfr を公開する手順

Gemini API キーを**クライアントに渡さず**、サーバー側の環境変数のみで安全に使う構成です。

---

## 前提

- Railway のアカウントがあること（[railway.app](https://railway.app)）
- プロジェクトを Git で管理していること（GitHub などにプッシュ済みだとスムーズ）

---

## ステップ1: リポジトリを Git で用意する

1. プロジェクトフォルダで Git を初期化していない場合:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Railway"
   ```
2. GitHub などにリモートを追加してプッシュ:
   ```bash
   git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
   git push -u origin main
   ```
   ※ ブランチ名が `main` でない場合は適宜読み替えてください。

**注意:** `config.js` に本番用の API キーを書かないでください。本番ではバックエンド（`/api/gemini-diagnosis`）が環境変数だけを使うため、`config.js` のキーは不要です。ローカル用にキーを入れている場合は、そのファイルを `.gitignore` に追加するか、リポジトリには「空またはダミー」の状態でコミットすることを推奨します。

---

## ステップ2: Railway で新規プロジェクトを作る

1. [Railway Dashboard](https://railway.app/dashboard) にログインする。
2. **「New Project」** をクリック。
3. **「Deploy from GitHub repo」** を選び、このプロジェクトのリポジトリを選択する（GitHub 連携がまだなら「Configure GitHub App」で許可）。
4. リポジトリを選ぶと、Railway が自動でビルド・デプロイを開始します。

---

## ステップ3: Gemini API キーを「環境変数」でだけ渡す（重要）

API キーをコードや HTML に含めず、Railway の環境変数だけで渡します。

1. Railway のプロジェクトを開く。
2. デプロイされている **サービス**（このリポジトリのサービス）をクリック。
3. **「Variables」** タブを開く。
4. **「+ New Variable」** で以下を追加:
   - **Variable:** `GEMINI_API_KEY`
   - **Value:** あなたの Gemini API キー（[Google AI Studio](https://aistudio.google.com/apikey) で発行したキー）
5. **「Add」** で保存する。

これで、キーはサーバー（Node）上でのみ参照され、ブラウザや HTML には一切送られません。**Value は誰にも共有せず、リポジトリにもコミットしないでください。**

---

## ステップ4: ビルドコマンドを確認する（必要なら設定）

- Railway は `package.json` があれば Node プロジェクトとして認識します。
- **Build Command:** 未指定でよいです（`npm install` が自動で実行されます）。
- **Start Command:** 未指定なら `npm start` が使われ、`server.js` が起動します。
- もし「Start Command」が別の値になっている場合は、**「Custom」** で `npm start` または `node server.js` に変更してください。

---

## ステップ5: ポートとドメインを確認する

- **PORT:** Railway は `PORT` 環境変数を自動で渡すので、`server.js` は `process.env.PORT` を使っています。追加設定は不要です。
- **公開URL:** サービスの **「Settings」** → **「Networking」** で **「Generate Domain」** を押すと、`xxx.up.railway.app` のような URL が発行されます。ここにアクセスするとアプリが開きます。

---

## ステップ6: 動作確認

1. 発行された URL（例: `https://xxx.up.railway.app`）をブラウザで開く。
2. 診断フローを進めて、最後に Gemini 診断が表示されるか確認する。
3. ブラウザの開発者ツール（F12）→ ネットワークで、`/api/gemini-diagnosis` への POST が成功（200）になっていることを確認する。  
   - ここで API キーがリクエストヘッダや URL に出ていなければ、キーはクライアントに露出していません。

---

## トラブルシューティング

| 症状 | 確認すること |
|------|----------------|
| 「GEMINI_API_KEY が設定されていません」 | Railway の Variables に `GEMINI_API_KEY` を追加し、値を保存したあと **Redeploy** する。 |
| 診断が「バックエンドに接続できません」 | 同じオリジンで `/api/gemini-diagnosis` が動いているか確認。Generate Domain で HTTPS の URL を使っているか確認。 |
| デプロイが失敗する | Railway の「Deployments」のログを確認。`npm install` と `npm start` が通るか、ローカルで `npm start` を実行して確認。 |

---

## セキュリティのまとめ

- **やること:** Gemini API キーは **Railway の Variables にだけ**入れ、`GEMINI_API_KEY` という名前で渡す。
- **やらないこと:** API キーを `config.js` や HTML 内、または GitHub などにコミットしない。本番ではフロントから直接 Gemini を呼ばず、必ず `server.js` の `/api/gemini-diagnosis` 経由にすること。

この手順に従えば、API キーはサーバー側でのみ保持され、安全に運用できます。

---

## 診断結果の蓄積（生年・性別・チェックしたイベント）

ユーザーが診断を完了するたびに、**生年・性別・ニックネーム・チェックしたイベント（年・イベント名）** がサーバーに送信され、`/api/diagnostic-result` で蓄積されます。

- **蓄積データの保存先:** デフォルトではプロジェクト内の `data/diagnostic-results.json` に追記されます。
- **永続化について:** Railway の通常デプロイでは再デプロイ時にファイルが消えます。**蓄積を永続させたい場合**は、Railway の **Volume** を追加し、マウントパス（例: `/data`）を設定したうえで、環境変数 **`DATA_DIR`** にそのパス（例: `DATA_DIR=/data`）を設定してください。すると `data/diagnostic-results.json` の代わりに `/data/diagnostic-results.json` に保存され、再デプロイ後も残ります。
- **蓄積一覧の取得:** `GET /api/diagnostic-results` で全件取得できます。キオスクモードの「総合結果」画面では、サーバーに蓄積されたデータと、この端末の localStorage の両方を表示します。
