# Fly.io で xnative_cfr を公開する手順

API キーを**クライアントに渡さず**、サーバー側のシークレット（環境変数）のみで使う構成です。1ステップずつ進めます。

---

## 前提

- [Fly.io](https://fly.io) のアカウント（メールまたは GitHub でサインアップ）
- ターミナル（PowerShell / cmd / bash など）が使えること
- プロジェクトを Git で管理しているとスムーズ（任意）

---

## ステップ1: flyctl をインストールする

Fly.io 用の CLI「flyctl」を入れます。

**Windows（PowerShell）:**

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**macOS / Linux:**

```bash
curl -L https://fly.io/install.sh | sh
```

インストール後、ターミナルを**いったん閉じて開き直す**と `fly` コマンドが使えるようになります。

確認:

```bash
fly version
```

---

## ステップ2: Fly.io にログインする

```bash
fly auth login
```

ブラウザが開くので、表示に従って Fly.io にサインアップまたはログインしてください。

---

## ステップ3: プロジェクトフォルダに移動する

xnative_cfr のプロジェクトのフォルダに移動します。

```bash
cd c:\Users\horte\Dropbox\_project\xnative_cfr
```

（実際のパスはあなたの環境に合わせてください。）

---

## ステップ4: アプリを「起動」する（fly.toml を作る）

初回だけ、Fly 上にアプリを作成し、設定ファイル `fly.toml` を生成します。

```bash
fly launch --no-deploy
```

次のように聞かれたら、次のように答えてください。

| 質問 | 入力例 |
|------|--------|
| App Name | `xnative-cfr` など（空 Enter で自動生成も可） |
| Region | 近いリージョン（例: `nrt` = 東京） |
| Would you like to set up a Postgresql database? | **No** |
| Would you like to set up an Upstash Redis database? | **No** |
| Would you like to copy its configuration to the new app? | 既存の fly.toml があれば **Yes**、なければスキップ |

`--no-deploy` を付けているので、この段階では**まだデプロイされません**。`fly.toml` が作成されていることを確認してください。

---

## ステップ5: ポート設定を確認する（必要なら fly.toml を編集）

Fly.io は起動時に **PORT** を自動で渡します（多くの場合 8080）。`server.js` は `process.env.PORT` を使っているので、そのままで問題ありません。

念のため `fly.toml` を開き、`[env]` で PORT を上書きしていなければそのままで大丈夫です。**何も書かなくてよい**場合がほとんどです。

---

## ステップ6: シークレット（API キー）を設定する

API キーは **fly secrets** で渡します。コードや HTML には一切含めません。

```bash
fly secrets set GEMINI_API_KEY=あなたのGeminiのAPIキー
```

キーは [Google AI Studio](https://aistudio.google.com/apikey) で発行できます。**Value は誰にも共有せず、リポジトリにもコミットしないでください。**

OpenAI も使う場合は:

```bash
fly secrets set OPENAI_API_KEY=あなたのOpenAIのAPIキー
```

---

## ステップ7: デプロイする

```bash
fly deploy
```

Dockerfile に従ってビルドが走り、Fly 上にデプロイされます。完了すると、表示される URL（例: `https://xnative-cfr.fly.dev`）でアプリにアクセスできます。

---

## ステップ8: 動作確認する

1. 表示された URL をブラウザで開く。
2. 診断フローを進めて、最後に AI 診断が表示されるか確認する。
3. ブラウザの開発者ツール（F12）→ ネットワークで、`/api/gemini-diagnosis` または `/api/openai-diagnosis` への POST が 200 になっているか確認する（ここに API キーが出ていなければ安全です）。

---

## オプション: 診断結果を永続化する（Volume）

診断結果（`diagnostic-results.json`）を再デプロイ後も残したい場合は、Volume を追加します。

1. **Volume を作成する（1回だけ）**

   ```bash
   fly volumes create data --region nrt --size 1
   ```

   `nrt` はステップ4で選んだリージョンに合わせてください。

   **「Do you still want to use the volumes feature? (y/N)」** と出たら、診断結果の永続化だけが目的なら **`y`** でよいです。Volume は1台のホストに紐づくためダウン時に使えなくなることがある、という注意です。本番で高可用が必要な場合は複数 Volume の構成を検討してください。

2. **fly.toml にマウントを書く**

   `fly.toml` の `[mounts]` を有効化・編集します。

   ```toml
   [mounts]
     source = "data"
     destination = "/data"
   ```

3. **環境変数で保存先を指定する**

   ```bash
   fly secrets set DATA_DIR=/data
   ```

4. **再デプロイ**

   ```bash
   fly deploy
   ```

これで、診断結果は `/data/diagnostic-results.json` に保存され、再デプロイ後も残ります。

---

## よくあるトラブル

| 症状 | 確認すること |
|------|----------------|
| 「GEMINI_API_KEY が設定されていません」 | `fly secrets set GEMINI_API_KEY=...` を実行したあと、**fly deploy** し直す。 |
| 診断が「バックエンドに接続できません」 | 同じ URL で `/api/gemini-diagnosis` が動いているか確認。HTTPS の URL で開いているか確認。 |
| デプロイが失敗する | `fly logs` でログを確認。ローカルで `docker build -t test .` や `node server.js` が動くか確認。 |
| 502 Bad Gateway | `server.js` が `process.env.PORT` で待ち受けているか確認。Fly は通常 8080 を渡す。 |

---

## コマンド一覧（参考）

| コマンド | 説明 |
|----------|------|
| `fly launch --no-deploy` | アプリ作成・fly.toml 生成（デプロイしない） |
| `fly deploy` | ビルドしてデプロイ |
| `fly open` | ブラウザでアプリを開く |
| `fly logs` | ログを表示 |
| `fly secrets list` | 設定したシークレット名の一覧（値は表示されない） |
| `fly status` | アプリの状態確認 |

---

## セキュリティのまとめ

- **やること:** Gemini / OpenAI の API キーは **fly secrets set** だけで渡す。
- **やらないこと:** API キーを `config.js` や HTML、GitHub にコミットしない。本番ではフロントから直接 API を呼ばず、必ず `server.js` の `/api/gemini-diagnosis` 等を経由させる。

この手順に従えば、API キーはサーバー側でのみ保持され、安全に運用できます。
