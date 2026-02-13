# 診断結果のサーバー側集約（diagnostic_results）の設定

キオスク診断で「終了して診断する」を実行すると、診断結果1件がフロントから次の2つのエンドポイントへ POST されます（どちらかが動いていれば保存されます）。

- **Cloudflare Pages**: `POST /api/diagnostic-result`
- **Netlify**: `POST /.netlify/functions/diagnostic-result`

どちらも **環境変数でバックエンドを有効にしたときだけ** 保存され、ローカルや未設定時は送信しても無視されるだけです。

---

## 1. Cloudflare Pages で集約する場合（D1）

1. **D1 データベースを作成**
   - ダッシュボード: Workers & Pages → D1 → Create database
   - 名前例: `nativemap-diagnostic-results`

2. **テーブルを作成**
   - D1 のコンソールで「SQL」を開き、次を実行:
   ```sql
   CREATE TABLE IF NOT EXISTS diagnostic_results (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT DEFAULT (datetime('now')),
     payload TEXT NOT NULL
   );
   ```

3. **Pages プロジェクトに D1 をバインド**
   - 対象の Pages プロジェクト → Settings → Functions → D1 database bindings
   - Variable name: **`DB`**（コードと同じ名前にする）
   - 作成した D1 データベースを選択

4. **デプロイ**
   - リポジトリのルートに `functions/api/diagnostic-result.js` を置いた状態でデプロイすると、`/api/diagnostic-result` が有効になります。

**データの取り出し**: D1 のコンソールで `SELECT * FROM diagnostic_results ORDER BY id DESC;` で一覧できます。`payload` に 1 件分の JSON（timestamp, gender, birthYear, owner, repo, filePath, selections）が入ります。

---

## 2. Netlify で集約する場合（Supabase）

1. **Supabase プロジェクトを作成**
   - [supabase.com](https://supabase.com) でプロジェクト作成

2. **テーブルを作成**
   - SQL Editor で次を実行:
   ```sql
   CREATE TABLE diagnostic_results (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     created_at timestamptz DEFAULT now(),
     payload jsonb NOT NULL
   );
   ```

3. **環境変数を Netlify に設定**
   - Site settings → Environment variables
   - `SUPABASE_URL`: プロジェクトの URL（例: `https://xxxx.supabase.co`）
   - `SUPABASE_SERVICE_ROLE_KEY`: Project settings → API の「service_role」のキー（秘密）

4. **デプロイ**
   - Netlify では `4netlify/functions/diagnostic-result.js` を Netlify Functions としてデプロイする構成にします（`4netlify` をルートにしてビルドする、または Netlify の「Functions directory」を `4netlify/functions` に指定する）。

**データの取り出し**: Supabase の Table Editor で `diagnostic_results` を開くか、SQL で `SELECT * FROM diagnostic_results ORDER BY created_at DESC;` で確認できます。

---

## 送信される1件の形式（payload）

```json
{
  "timestamp": "2025-02-12T12:34:56.789Z",
  "gender": "male",
  "birthYear": 1990,
  "owner": "hortense667",
  "repo": "nativemap",
  "filePath": "timeline.json",
  "selections": [
    { "year": 1983, "label": "任天堂ファミコン", "genre": "GAM" },
    { "year": 1996, "label": "ポケットモンスター", "genre": "GAM" }
  ]
}
```
