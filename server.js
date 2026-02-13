/**
 * Railway 用サーバー
 * - 静的ファイル（HTML等）を配信
 * - POST /api/gemini-diagnosis で Gemini API を呼び出し（APIキーはサーバー側の環境変数のみ使用）
 * - POST /api/diagnostic-result でユーザーごとの生年・性別・チェックしたイベントを蓄積
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// 蓄積データの保存先（Railway で永続化する場合は Volume を DATA_DIR にマウント推奨）
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DIAGNOSTIC_RESULTS_FILE = path.join(DATA_DIR, 'diagnostic-results.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDiagnosticResults() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DIAGNOSTIC_RESULTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeDiagnosticResults(list) {
  ensureDataDir();
  fs.writeFileSync(DIAGNOSTIC_RESULTS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// 静的ファイル（カレントディレクトリ）を配信
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// ルートはメインHTMLへ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'xnative_cfr_r050.html'));
});

async function callGeminiWithRetry(url, prompt, maxRetries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048 }
        })
      });

      const raw = await geminiRes.text();
      let data = null;
      try {
        if (raw) data = JSON.parse(raw);
      } catch (_) {}

      if (!geminiRes.ok) {
        const msg = data?.error?.message || data?.error || `HTTP ${geminiRes.status}`;
        lastError = String(msg);
        // 高負荷や一時的エラーと思われる場合はリトライ
        const retriable =
          geminiRes.status >= 500 ||
          geminiRes.status === 429 ||
          (typeof lastError === 'string' &&
            /high demand|please try again later/i.test(lastError));
        if (retriable && attempt < maxRetries) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        return { ok: false, error: lastError };
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return { ok: true, text: text.trim() };
      }
      return {
        ok: false,
        error: 'APIは応答しましたが、診断テキストが含まれていませんでした。'
      };
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      lastError = msg;
      // 通信系の一時エラーはリトライ
      if (attempt < maxRetries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      return { ok: false, error: '通信エラー: ' + msg };
    }
  }
  return { ok: false, error: lastError || '未知のエラー' };
}

async function callOpenAiOnce(prompt) {
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
    return { ok: false, error: 'サーバーに OPENAI_API_KEY が設定されていません。Railway の Variables で設定してください。' };
  }
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    const raw = await resp.text();
    let data = null;
    try {
      if (raw) data = JSON.parse(raw);
    } catch (_) {}
    if (!resp.ok) {
      const msg = data?.error?.message || data?.error || `HTTP ${resp.status}`;
      return { ok: false, error: String(msg) };
    }
    const text = data?.choices?.[0]?.message?.content;
    if (text && text.trim()) {
      return { ok: true, text: text.trim() };
    }
    return { ok: false, error: 'APIは応答しましたが、診断テキストが含まれていませんでした。' };
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return { ok: false, error: '通信エラー: ' + msg };
  }
}

// Gemini 診断 API（APIキーはサーバー側の環境変数のみ参照・クライアントに一切渡さない）
app.post('/api/gemini-diagnosis', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(500).json({
      ok: false,
      error: 'サーバーに GEMINI_API_KEY が設定されていません。Railway の Variables で設定してください。'
    });
  }

  const { prompt, model } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok: false, error: 'prompt が必要です。' });
  }

  const geminiModel = model || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  try {
    const result = await callGeminiWithRetry(url, prompt, 2);
    if (result.ok) {
      return res.json(result);
    }
    return res.status(502).json({ ok: false, error: result.error });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: '通信エラー: ' + msg });
  }
});

// OpenAI 診断 API（APIキーはサーバー側の環境変数のみ参照・クライアントに一切渡さない）
app.post('/api/openai-diagnosis', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok: false, error: 'prompt が必要です。' });
  }
  const result = await callOpenAiOnce(prompt);
  if (result.ok) {
    return res.json(result);
  }
  return res.status(502).json({ ok: false, error: result.error });
});

// 診断結果の蓄積（生年・性別・チェックしたイベントの年とイベント名）
app.post('/api/diagnostic-result', (req, res) => {
  const record = req.body;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ ok: false, error: 'body が必要です。' });
  }
  // 年表JSONのパスとファイル名
  const filePath = record.filePath != null ? String(record.filePath) : '';

  // 選択されたイベント（ジャンルコードを配列で保持）
  const selections = Array.isArray(record.selections)
    ? record.selections.map(s => ({
        year: s.year != null ? s.year : null,
        label: s.label != null ? String(s.label) : '',
        genreCodes: Array.isArray(s.genre)
          ? s.genre.map(g => String(g))
          : (s.genre != null && s.genre !== '')
            ? [String(s.genre)]
            : []
      }))
    : [];

  const normalized = {
    timestamp: record.timestamp || new Date().toISOString(),
    gender: record.gender != null ? String(record.gender) : '',
    birthYear: record.birthYear != null ? record.birthYear : null,
    nickname: record.nickname != null ? String(record.nickname) : '',
    owner: record.owner != null ? String(record.owner) : '',
    repo: record.repo != null ? String(record.repo) : '',
    filePath,
    timelineFileName: filePath ? path.basename(filePath) : '',
    selections,
    selectedGenres: Array.isArray(record.selectedGenres)
      ? record.selectedGenres.map(g => String(g))
      : []
  };
  try {
    const list = readDiagnosticResults();
    list.push(normalized);
    writeDiagnosticResults(list);
    return res.json({ ok: true, count: list.length });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: '保存に失敗しました: ' + msg });
  }
});

// 蓄積一覧の取得（管理・表示用）
app.get('/api/diagnostic-results', (req, res) => {
  try {
    const list = readDiagnosticResults();
    return res.json({ ok: true, results: list, count: list.length });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
