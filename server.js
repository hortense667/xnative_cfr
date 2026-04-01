/**
 * Railway 用サーバー
 * - 静的ファイル（HTML等）を配信
 * - POST /api/gemini-diagnosis で Gemini API を呼び出し（APIキーはサーバー側の環境変数のみ使用）
 * - POST /api/openai-diagnosis で OpenAI API を呼び出し（APIキーはサーバー側の環境変数のみ使用）
 * - POST /api/diagnostic-result でユーザーごとの生年・性別・チェックしたイベントを蓄積
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const API_JSON_LIMIT = process.env.API_JSON_LIMIT || '64kb';
const RATE_LIMIT_WINDOW_MS = toPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000);
const RATE_LIMIT_GET_RESULTS_PER_MIN = toPositiveInt(process.env.RATE_LIMIT_GET_RESULTS_PER_MIN, 60);
const RATE_LIMIT_POST_RESULT_PER_MIN = toPositiveInt(process.env.RATE_LIMIT_POST_RESULT_PER_MIN, 30);
const RATE_LIMIT_POST_AI_PER_MIN = toPositiveInt(process.env.RATE_LIMIT_POST_AI_PER_MIN, 10);
const MAX_PROMPT_CHARS = toPositiveInt(process.env.MAX_PROMPT_CHARS, 40000);
const BACKUP_RETENTION_DAYS = toPositiveInt(process.env.BACKUP_RETENTION_DAYS, 31);

const rateLimitBuckets = new Map();

function getRateLimitFor(req) {
  if (req.method === 'GET' && req.path === '/api/diagnostic-results') {
    return RATE_LIMIT_GET_RESULTS_PER_MIN;
  }
  if (req.method === 'POST' && req.path === '/api/diagnostic-result') {
    return RATE_LIMIT_POST_RESULT_PER_MIN;
  }
  if (
    req.method === 'POST' &&
    (req.path === '/api/gemini-diagnosis' || req.path === '/api/openai-diagnosis')
  ) {
    return RATE_LIMIT_POST_AI_PER_MIN;
  }
  return 120;
}

function apiRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const key = `${ip}:${req.method}:${req.path}`;
  const now = Date.now();
  const limit = getRateLimitFor(req);
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
  }

  const current = rateLimitBuckets.get(key);
  const remaining = Math.max(0, limit - current.count);
  const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

  if (current.count > limit) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      ok: false,
      error: `アクセスが集中しています。しばらく待って再試行してください。（${retryAfterSec}秒後）`
    });
  }

  if (rateLimitBuckets.size > 5000) {
    for (const [k, v] of rateLimitBuckets.entries()) {
      if (now >= v.resetAt) rateLimitBuckets.delete(k);
    }
  }
  return next();
}

function validatePromptField(prompt) {
  if (typeof prompt !== 'string') {
    return 'prompt が必要です。';
  }
  const trimmed = prompt.trim();
  if (!trimmed) {
    return 'prompt が空です。';
  }
  if (trimmed.length > MAX_PROMPT_CHARS) {
    return `prompt が長すぎます。最大 ${MAX_PROMPT_CHARS} 文字です。`;
  }
  return null;
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DIAGNOSTIC_RESULTS_FILE = path.join(DATA_DIR, 'diagnostic-results.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getDateStamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function deleteExpiredBackups() {
  try {
    const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
    const now = Date.now();
    const maxAgeMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/^diagnostic-results-\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
      const fullPath = path.join(BACKUP_DIR, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        if ((now - stat.mtimeMs) > maxAgeMs) {
          fs.unlinkSync(fullPath);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

function ensureDailyBackup() {
  ensureDataDir();
  const dateStamp = getDateStamp();
  const backupPath = path.join(BACKUP_DIR, `diagnostic-results-${dateStamp}.json`);
  if (fs.existsSync(backupPath)) return;
  try {
    if (fs.existsSync(DIAGNOSTIC_RESULTS_FILE)) {
      fs.copyFileSync(DIAGNOSTIC_RESULTS_FILE, backupPath);
    } else {
      fs.writeFileSync(backupPath, '[]', 'utf8');
    }
  } catch (e) {
    console.warn('Daily backup creation failed:', e && e.message ? e.message : String(e));
  }
  deleteExpiredBackups();
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
  ensureDailyBackup();
  fs.writeFileSync(DIAGNOSTIC_RESULTS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: API_JSON_LIMIT }));
app.use('/api', apiRateLimit);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'xnative_cfr_r050.html'));
});

function clampTemperature(t) {
  if (t == null || t === '') return 0.9;
  const n = Number(t);
  if (Number.isNaN(n)) return 0.9;
  return Math.min(2, Math.max(0, n));
}

async function callGeminiWithRetry(url, prompt, maxRetries = 2, temperature = 0.9) {
  const temp = clampTemperature(temperature);
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: temp }
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
        const retriable =
          geminiRes.status >= 500 ||
          geminiRes.status === 429 ||
          (typeof lastError === 'string' && /high demand|please try again later/i.test(lastError));
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
      if (attempt < maxRetries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      return { ok: false, error: '通信エラー: ' + msg };
    }
  }
  return { ok: false, error: lastError || '未知のエラー' };
}

async function callOpenAiWithRetry(prompt, maxRetries = 2, temperature = 0.9, options = {}) {
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim()) {
    return {
      ok: false,
      error: 'サーバーに OPENAI_API_KEY が設定されていません。Railway の Variables で設定してください。'
    };
  }
  const temp = clampTemperature(temperature);
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  const model = (options && typeof options.model === 'string' && options.model.trim())
    ? options.model.trim()
    : (process.env.OPENAI_MODEL || 'gpt-5.4');
  const responseFormat = (options && options.responseFormat) ? options.responseFormat : null;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: temp,
        max_tokens: 1800
      };
      if (responseFormat) body.response_format = responseFormat;

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`
        },
        body: JSON.stringify(body)
      });

      const raw = await resp.text();
      let data = null;
      try {
        if (raw) data = JSON.parse(raw);
      } catch (_) {}

      if (!resp.ok) {
        const msg = data?.error?.message || data?.error || `HTTP ${resp.status}`;
        lastError = String(msg);
        const retriable = resp.status >= 500 || resp.status === 429;
        if (retriable && attempt < maxRetries) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        return { ok: false, error: lastError };
      }

      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) {
        return { ok: true, text: text.trim(), model };
      }

      return {
        ok: false,
        error: 'APIは応答しましたが、診断テキストが含まれていませんでした。'
      };
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      lastError = msg;
      if (attempt < maxRetries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      return { ok: false, error: '通信エラー: ' + msg };
    }
  }

  return { ok: false, error: lastError || '未知のエラー' };
}

function buildMode2DiagnosisResponseFormat() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'mode2_diagnosis',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mainAttribute: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              short: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['name', 'short', 'reason']
          },
          subAttribute: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              short: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['name', 'short', 'reason']
          },
          hiddenAttribute: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              short: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['name', 'short', 'reason']
          },
          lowerModules: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                reason: { type: 'string' }
              },
              required: ['name', 'reason']
            }
          },
          practiceModes: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                reason: { type: 'string' }
              },
              required: ['name', 'reason']
            }
          },
          emblemCode: { type: 'string' },
          epithet: { type: 'string' },
          epithetShort: { type: 'string' },
          epithetReason: { type: 'string' },
          summary: { type: 'string' },
          readingPoints: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 3
          },
          shareText: { type: 'string' }
        },
        required: [
          'mainAttribute',
          'subAttribute',
          'hiddenAttribute',
          'lowerModules',
          'practiceModes',
          'emblemCode',
          'epithet',
          'epithetShort',
          'epithetReason',
          'summary',
          'readingPoints',
          'shareText'
        ]
      }
    }
  };
}

const APOLOGY_MESSAGE = '申し訳ありません。現在、利用可能なAI（Gemini / OpenAI）がいずれも高負荷またはエラーのため診断結果を生成できませんでした。時間をおいてもう一度お試しください。';

app.post('/api/gemini-diagnosis', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(500).json({
      ok: false,
      error: 'サーバーに GEMINI_API_KEY が設定されていません。Railway の Variables で設定してください。'
    });
  }

  const { prompt, model, temperature } = req.body || {};
  const promptError = validatePromptField(prompt);
  if (promptError) {
    return res.status(400).json({ ok: false, error: promptError });
  }
  const temp = clampTemperature(temperature);

  const geminiModel = model || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  try {
    const primary = await callGeminiWithRetry(url, prompt, 2, temp);
    if (primary.ok) {
      return res.json(primary);
    }

    let fallbackError = primary.error;
    if (OPENAI_API_KEY && OPENAI_API_KEY.trim()) {
      const secondary = await callOpenAiWithRetry(prompt, 2, temp, {
        model: process.env.OPENAI_MODEL || 'gpt-5.4'
      });
      if (secondary.ok) {
        return res.json(secondary);
      }
      fallbackError = secondary.error || fallbackError;
    }

    return res.status(502).json({
      ok: false,
      error: `${APOLOGY_MESSAGE}（詳細: ${fallbackError}）`
    });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: '通信エラー: ' + msg });
  }
});

app.post('/api/openai-diagnosis', async (req, res) => {
  const { prompt, temperature, model, mode } = req.body || {};
  const promptError = validatePromptField(prompt);
  if (promptError) {
    return res.status(400).json({ ok: false, error: promptError });
  }

  const temp = clampTemperature(temperature);
  const requestedModel = (typeof model === 'string' && model.trim())
    ? model.trim()
    : (process.env.OPENAI_MODEL || 'gpt-5.4');

  const useStructuredOutput =
    String(mode || '') === '2' ||
    /mainAttribute|subAttribute|hiddenAttribute|readingPoints|lowerModules|practiceModes|epithetShort/.test(prompt);

  const responseFormat = useStructuredOutput ? buildMode2DiagnosisResponseFormat() : null;

  try {
    const primary = await callOpenAiWithRetry(prompt, 2, temp, {
      model: requestedModel,
      responseFormat
    });
    if (primary.ok) {
      return res.json(primary);
    }

    let fallbackError = primary.error;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim()) {
      const geminiModel = 'gemini-2.5-flash-lite';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const secondary = await callGeminiWithRetry(url, prompt, 2, temp);
      if (secondary.ok) {
        return res.json(secondary);
      }
      fallbackError = secondary.error || fallbackError;
    }

    return res.status(502).json({
      ok: false,
      error: `${APOLOGY_MESSAGE}（詳細: ${fallbackError}）`
    });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: '通信エラー: ' + msg });
  }
});

app.post('/api/diagnostic-result', (req, res) => {
  const record = req.body;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ ok: false, error: 'body が必要です。' });
  }

  const filePath = record.filePath != null ? String(record.filePath) : '';

  const selections = Array.isArray(record.selections)
    ? record.selections.map(s => ({
        year: s.year != null ? s.year : null,
        label: s.label != null ? String(s.label) : '',
        genreCodes: Array.isArray(s.genre)
          ? s.genre.map(g => String(g))
          : (s.genre != null && s.genre !== '')
            ? [String(s.genre)]
            : [],
        meaningTags: Array.isArray(s.meaningTags)
          ? s.meaningTags.map(t => String(t))
          : Array.isArray(s.tags)
            ? s.tags.map(t => String(t))
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
    testid: record.testid != null ? String(record.testid) : (record.testId != null ? String(record.testId) : ''),
    filePath,
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

app.get('/api/diagnostic-results', (req, res) => {
  try {
    const list = readDiagnosticResults();
    const sanitized = list.map((r) => {
      const rec = (r && typeof r === 'object') ? r : {};
      const { timelineFileName, testId, ...rest } = rec;
      return {
        ...rest,
        testid: rec.testid != null ? String(rec.testid) : (testId != null ? String(testId) : '')
      };
    });
    return res.json({ ok: true, results: sanitized, count: sanitized.length });
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      ok: false,
      error: `リクエストサイズが大きすぎます。上限は ${API_JSON_LIMIT} です。`
    });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});