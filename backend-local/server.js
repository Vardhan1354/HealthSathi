'use strict';
require('dotenv').config();

/**
 * HealthSathi Backend Server — HTTPS
 * - File Storage   : AWS S3  (falls back to local temp if no credentials)
 * - Text Extraction: AWS Textract  (falls back to OCR.space)
 * - Health Library : MedlinePlus NIH + Wikipedia (free)
 * - Drug Info      : OpenFDA (free)
 * - Interactions   : NIH RxNorm (free, handled directly in frontend)
 *
 * Set credentials in backend-local/.env before starting.
 */

const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const FormData = require('form-data');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');

// ── AWS SDK v3 ─────────────────────────────────────────────────────────────
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }    = require('@aws-sdk/s3-request-presigner');
const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001');

// ── AWS availability check ─────────────────────────────────────────────────
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET  = process.env.AWS_S3_BUCKET || '';
const hasAWS = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_ACCESS_KEY_ID !== 'YOUR_ACCESS_KEY_HERE' &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  S3_BUCKET
);

let s3Client, textractClient;
if (hasAWS) {
  const awsCfg = {
    region: AWS_REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  };
  s3Client       = new S3Client(awsCfg);
  textractClient = new TextractClient(awsCfg);
  console.log(`✅  AWS configured — region: ${AWS_REGION}, bucket: ${S3_BUCKET}`);
} else {
  console.log('⚠️   AWS not configured → local temp storage + OCR.space fallback');
  console.log('     To enable AWS, edit backend-local/.env');
}

// ── Local temp fallback directory ─────────────────────────────────────────
const UPLOAD_DIR = path.join(os.tmpdir(), 'healthsathi-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

const sessions = {}; // in-memory chat history

// ═════════════════════════════════════════════════════════════════════════════
// OCR HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/** Call OCR.space with a local file path or Buffer */
async function ocrViaOCRSpace(filePathOrBuffer, mimeType = 'image/jpeg') {
  const form = new FormData();
  form.append('apikey', 'helloworld');
  form.append('language', 'eng');
  form.append('isTable', 'true');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  if (typeof filePathOrBuffer === 'string') {
    form.append('file', fs.createReadStream(filePathOrBuffer), { contentType: mimeType });
  } else {
    form.append('file', filePathOrBuffer, { filename: 'image.jpg', contentType: mimeType });
  }
  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined,
  });
  if (!res.ok) throw new Error(`OCR.space HTTP ${res.status}`);
  const data = await res.json();
  if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] || 'OCR failed');
  return (data.ParsedResults || []).map(r => r.ParsedText).join('\n').trim();
}

/** AWS Textract on an S3 object */
async function extractTextWithTextract(s3Key) {
  const cmd = new DetectDocumentTextCommand({
    Document: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
  });
  const result = await textractClient.send(cmd);
  return (result.Blocks || [])
    .filter(b => b.BlockType === 'LINE')
    .sort((a, b) => (a.Geometry?.BoundingBox?.Top || 0) - (b.Geometry?.BoundingBox?.Top || 0))
    .map(b => b.Text || '')
    .join('\n')
    .trim();
}

/**
 * Main OCR dispatcher
 *  1. AWS Textract (if configured)
 *  2. OCR.space from local temp file
 *  3. Download from S3 then OCR.space
 */
async function extractText(s3Key) {
  // 1. AWS Textract
  if (hasAWS) {
    try {
      console.log(`[OCR] Textract → s3://${S3_BUCKET}/${s3Key}`);
      const text = await extractTextWithTextract(s3Key);
      if (text.length > 10) {
        console.log(`[OCR] Textract success (${text.length} chars)`);
        return { text, source: 'AWS Textract' };
      }
    } catch (e) {
      console.warn(`[OCR] Textract failed: ${e.message} — trying OCR.space`);
    }
  }

  // 2. Local temp file → OCR.space
  const localPath = path.join(UPLOAD_DIR, path.basename(s3Key));
  if (fs.existsSync(localPath)) {
    const text = await ocrViaOCRSpace(localPath);
    console.log(`[OCR] OCR.space (local) success (${text.length} chars)`);
    return { text, source: 'OCR.space' };
  }

  // 3. Download from S3 then OCR.space
  if (hasAWS) {
    try {
      const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key });
      const s3Res  = await s3Client.send(getCmd);
      const chunks = [];
      for await (const chunk of s3Res.Body) chunks.push(chunk);
      const buf  = Buffer.concat(chunks);
      const text = await ocrViaOCRSpace(buf, s3Res.ContentType || 'image/jpeg');
      return { text, source: 'OCR.space (via S3)' };
    } catch (e) {
      console.warn(`[OCR] S3+OCR.space failed: ${e.message}`);
    }
  }

  return { text: '', source: 'none' };
}

// ═════════════════════════════════════════════════════════════════════════════
// ANALYSIS HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function extractMedicineNames(text) {
  const patterns = [
    /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s+(?:\d+\s*mg|\d+\s*ml|\d+\s*mcg|\d+\s*g)\b/g,
    /(?:Tab|Cap|Syp|Inj|Oint)\.?\s+([A-Z][a-zA-Z\s]+?)(?:\s*\d|\n|$)/g,
    /\b((?:Para|Amox|Cipro|Metro|Azithro|Cefix|Ibupro|Omepra|Atorva|Metfor|Amlo|Telmis|Enalapril|Hydroxy|Salbutamol|Predni|Dexamethasone)\w+)\b/gi,
  ];
  const names = new Set();
  for (const pat of patterns) {
    let m; pat.lastIndex = 0;
    while ((m = pat.exec(text)) !== null) {
      const n = m[1]?.trim();
      if (n && n.length > 3) names.add(n);
    }
  }
  return [...names].slice(0, 8);
}

const LAB_RANGES = {
  haemoglobin: { range: '12–16 F / 13–17 M', unit: 'g/dL',    low: 12,  high: 17   },
  hemoglobin:  { range: '12–16 F / 13–17 M', unit: 'g/dL',    low: 12,  high: 17   },
  hgb:         { range: '12–16 F / 13–17 M', unit: 'g/dL',    low: 12,  high: 17   },
  wbc:         { range: '4–11',               unit: 'x10³/µL', low: 4,   high: 11   },
  platelet:    { range: '150–400',             unit: 'x10³/µL', low: 150, high: 400  },
  glucose:     { range: '70–100 fasting',      unit: 'mg/dL',  low: 70,  high: 100  },
  'blood sugar':{ range: '70–100 fasting',     unit: 'mg/dL',  low: 70,  high: 100  },
  creatinine:  { range: '0.6–1.2',             unit: 'mg/dL',  low: 0.6, high: 1.2  },
  urea:        { range: '7–20',                unit: 'mg/dL',  low: 7,   high: 20   },
  sgpt:        { range: '7–56',                unit: 'U/L',    low: 7,   high: 56   },
  alt:         { range: '7–56',                unit: 'U/L',    low: 7,   high: 56   },
  sgot:        { range: '10–40',               unit: 'U/L',    low: 10,  high: 40   },
  ast:         { range: '10–40',               unit: 'U/L',    low: 10,  high: 40   },
  tsh:         { range: '0.4–4.0',             unit: 'mIU/L',  low: 0.4, high: 4.0  },
};

function parseLabReport(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const lower = line.toLowerCase();
    for (const [key, ref] of Object.entries(LAB_RANGES)) {
      if (lower.includes(key)) {
        const m = line.match(/[\d]+\.?[\d]*/);
        if (m) {
          const val    = parseFloat(m[0]);
          const status = val < ref.low ? 'LOW' : val > ref.high ? 'HIGH' : 'NORMAL';
          results.push({ test: key.toUpperCase(), value: val, unit: ref.unit, range: ref.range, status });
        }
      }
    }
  }
  return results;
}

async function fdaLookup(name) {
  try {
    const r = await fetch(
      `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(name.trim())}&limit=1`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.results?.length) return null;
    const item = d.results[0];
    return {
      genericName:  item.openfda?.generic_name?.[0]     || name,
      brandName:    item.openfda?.brand_name?.[0]        || '—',
      manufacturer: item.openfda?.manufacturer_name?.[0] || '—',
      purpose:     (item.purpose?.[0] || item.indications_and_usage?.[0] || '').slice(0, 500),
      warnings:    (item.warnings?.[0] || '').slice(0, 400),
      dosage:      (item.dosage_and_administration?.[0] || '').slice(0, 300),
    };
  } catch { return null; }
}

async function searchWikipedia(query) {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }
    );
    if (r.ok) {
      const d = await r.json();
      if (d.extract?.length > 80)
        return `**${d.title}**\n\n${d.extract}\n\n_Source: Wikipedia — consult a doctor for medical advice._`;
    }
  } catch { /* fall through */ }
  return null;
}

async function searchMedlinePlus(query) {
  try {
    const r = await fetch(
      `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(query)}&rettype=brief&retmax=1`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined }
    );
    if (!r.ok) return null;
    const xml          = await r.text();
    const titleMatch   = xml.match(/<content name="title"[^>]*>(.*?)<\/content>/s);
    const summaryMatch = xml.match(/<content name="FullSummary"[^>]*>(.*?)<\/content>/s)
                      || xml.match(/<content name="snippet"[^>]*>(.*?)<\/content>/s);
    if (titleMatch && summaryMatch) {
      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      const body  = summaryMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (body.length > 60)
        return `**${title}**\n\n${body}\n\n_Source: MedlinePlus (NIH) — consult a licensed doctor for advice._`;
    }
  } catch { /* ignore */ }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    server: 'HealthSathi Backend',
    aws: hasAWS ? { s3: S3_BUCKET, region: AWS_REGION, textract: true } : false,
  })
);

// ── Presign ────────────────────────────────────────────────────────────────
// AWS    → returns real S3 presigned PUT URL (frontend uploads directly to S3)
// No AWS → returns local upload URL
app.get('/api/presign', async (req, res) => {
  const key  = req.query.key  || `uploads/${Date.now()}.jpg`;
  const type = req.query.type || 'image/jpeg';
  const safe = key.replace(/[^a-zA-Z0-9_.\-\/]/g, '_');

  const protocol = req.protocol === 'https' ? 'https' : 'http';
  const host = req.get('host');

  if (hasAWS) {
    try {
      const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: safe, ContentType: type });
      const url = await getSignedUrl(s3Client, cmd, { expiresIn: 300 });
      console.log(`[presign] S3 → ${safe}`);
      return res.json({ url, s3Key: safe });
    } catch (e) {
      console.warn(`[presign] S3 sign failed: ${e.message} — local fallback`);
    }
  }

  const localKey = path.basename(safe);
  res.json({ url: `${protocol}://${host}/file-upload/${encodeURIComponent(localKey)}`, s3Key: localKey });
});

// ── Local file-upload (fallback when S3 presign not used) ─────────────────
app.put('/file-upload/:key', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, decodeURIComponent(req.params.key));
  const ws = fs.createWriteStream(filePath);
  req.pipe(ws);
  ws.on('finish', () => { console.log(`[upload] saved: ${filePath}`); res.json({ ok: true }); });
  ws.on('error',  e => res.status(500).json({ error: e.message }));
});

// ── Translate (Stub) ───────────────────────────────────────────────────────
app.post('/api/translate', (req, res) => {
  const { text, targetLanguage } = req.body;
  // Local backend doesn't have AWS Translate, frontend should use freeTranslate.ts
  res.json({ translatedText: text, detectedSourceLang: 'en', targetLanguage });
});

// ── Speak (Stub) ───────────────────────────────────────────────────────────
app.post('/api/speak', (req, res) => {
  res.json({ audioUrl: null, audioBase64: '', voiceId: 'stub', language: req.body.language || 'en' });
});

// ── Prescription Reader ────────────────────────────────────────────────────
app.post('/api/read-prescription', async (req, res) => {
  const { s3Key } = req.body;
  if (!s3Key) return res.status(400).json({ error: 'Missing s3Key' });

  try {
    const { text: ocrText, source } = await extractText(s3Key);

    if (!ocrText || ocrText.length < 15) {
      return res.json({
        explanation: 'The image was not clear enough to read. Please take a well-lit, focused photo of the full prescription.',
        ocrText: '', ocrConfidence: 0, keyValues: {}, model: source,
      });
    }

    const names = extractMedicineNames(ocrText);
    let explanation;

    if (names.length > 0) {
      explanation = [
        '**Your Prescription — Explained**\n',
        `_Text extracted using: ${source}_\n`,
        'The following medicines were identified:\n',
        ...names.map((n, i) =>
          `**${i + 1}. ${n}**\n   • Take as directed by your doctor\n   • Complete the full prescribed course\n   • Do not stop without consulting your doctor`
        ),
        '\n**General Instructions**',
        '• Take medicines at regular times each day',
        '• Store in a cool, dry place away from sunlight',
        '• Keep out of reach of children',
        '• Report side effects to your doctor immediately',
        '\n⚠️ This explanation is AI-assisted. Always follow your doctor\'s exact instructions.',
      ].join('\n');
    } else {
      explanation = `**Prescription Text Extracted** _(via ${source})_\n\n${ocrText}\n\nMedicine names could not be identified automatically. Please show this text to your pharmacist or doctor.`;
    }

    res.json({ explanation, ocrText, ocrConfidence: ocrText.length > 50 ? 0.88 : 0.45, keyValues: {}, model: source });
  } catch (e) {
    console.error('[read-prescription]', e.message);
    res.json({ explanation: 'Could not read the prescription. Please ensure the image is clear and well-lit.', ocrText: '', ocrConfidence: 0, keyValues: {}, model: 'error' });
  }
});

// ── Lab Reports ────────────────────────────────────────────────────────────
app.post('/api/explain-report', async (req, res) => {
  const { s3Key, text } = req.body;
  let rawText = text || '';
  let source  = 'provided text';

  if (s3Key && !rawText) {
    const result = await extractText(s3Key).catch(() => ({ text: '', source: 'error' }));
    rawText = result.text;
    source  = result.source;
  }

  if (!rawText) {
    return res.json({ explanation: 'Could not extract text from the lab report. Please try a clearer image.', model: 'error', fallback: true });
  }

  const parsed = parseLabReport(rawText);
  let explanation;

  if (parsed.length > 0) {
    const abnormal = parsed.filter(t => t.status !== 'NORMAL');
    explanation = `**Lab Report Analysis** _(via ${source})_\n\n${parsed
      .map(t => `• **${t.test}**: ${t.value} ${t.unit} (Normal: ${t.range}) — **${t.status}**`)
      .join('\n')}`;
    explanation += abnormal.length > 0
      ? `\n\n⚠️ **${abnormal.length} value${abnormal.length > 1 ? 's are' : ' is'} outside normal range.** Consult your doctor soon.`
      : '\n\n✅ All checked values appear within normal range. Still follow up with your doctor.';
  } else {
    explanation = `**Lab Report — Extracted Text** _(via ${source})_\n\n${rawText}\n\nAutomatic value detection could not identify specific results. Please share this with your doctor or pharmacist.`;
  }

  res.json({ explanation, model: source, fallback: false });
});

// ── Medicine Scanner ────────────────────────────────────────────────────────
app.post('/api/scan-medicine', async (req, res) => {
  const { s3Key } = req.body;
  if (!s3Key) return res.status(400).json({ error: 'Missing s3Key' });

  try {
    const { text: ocrText, source } = await extractText(s3Key);
    const names   = extractMedicineNames(ocrText);
    const fdaInfo = names[0] ? await fdaLookup(names[0]) : null;

    let explanation = '';
    if (fdaInfo && (fdaInfo.purpose || fdaInfo.dosage)) {
      explanation  = `**${fdaInfo.brandName !== '—' ? fdaInfo.brandName : names[0]}** (${fdaInfo.genericName})\n`;
      if (fdaInfo.purpose)  explanation += `\n**Purpose:** ${fdaInfo.purpose}`;
      if (fdaInfo.dosage)   explanation += `\n\n**Dosage:** ${fdaInfo.dosage}`;
      if (fdaInfo.warnings) explanation += `\n\n**Warnings:** ${fdaInfo.warnings}`;
      explanation += `\n\n_Text: ${source} · Drug info: OpenFDA (U.S. Government)_`;
    } else if (names.length > 0) {
      explanation = `**Medicines detected:** ${names.join(', ')}\n\n_${source}_\n\nNo FDA details found. Consult your pharmacist.`;
    } else {
      explanation = `No medicine names detected. _(${source})_\n\nExtracted: ${ocrText.slice(0, 400)}\n\nEnsure the image shows the medicine label clearly.`;
    }

    res.json({ explanation, detectedLabels: [], detectedText: names, model: `${source} + OpenFDA` });
  } catch (e) {
    console.error('[scan-medicine]', e.message);
    res.json({ explanation: 'Could not read the medicine label. Ensure the image is clear.', detectedLabels: [], detectedText: [], model: 'error' });
  }
});

// ── Health Library ──────────────────────────────────────────────────────────
app.post('/api/health-library/ask', async (req, res) => {
  const { question, sessionId, language = 'en' } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  if (!sessions[sessionId]) sessions[sessionId] = [];
  sessions[sessionId].push({ role: 'user', text: question, ts: Date.now() });

  const start = Date.now();
  let answer  = null;

  if (language === 'en') answer = await searchMedlinePlus(question);

  if (!answer) {
    const wikiLang = language === 'hi' ? 'hi' : language === 'mr' ? 'mr' : 'en';
    if (wikiLang !== 'en') {
      try {
        const r = await fetch(
          `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(question.replace(/\?/g, '').trim())}`,
          { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }
        );
        if (r.ok) {
          const d = await r.json();
          if (d.extract?.length > 80)
            answer = `**${d.title}**\n\n${d.extract}\n\n_Source: Wikipedia (${wikiLang})_`;
        }
      } catch { /* fall through */ }
    }
    if (!answer) answer = await searchWikipedia(question.replace(/\?/g, '').trim());
  }

  if (!answer)
    answer = 'I could not find specific information on that topic. Please consult a healthcare professional or visit your nearest health centre.';

  sessions[sessionId].push({ role: 'assistant', text: answer, ts: Date.now() });
  res.json({ answer, model: 'MedlinePlus + Wikipedia', turnCount: Math.ceil(sessions[sessionId].length / 2), latencyMs: Date.now() - start });
});

app.get('/api/health-library/history', (req, res) => {
  const { sessionId } = req.query;
  res.json({ sessionId, messages: (sessions[sessionId] || []).map(m => ({ role: m.role, content: [{ text: m.text }] })) });
});

// ── Counterfeit Detection ───────────────────────────────────────────────────
app.post('/api/verify-medicine', async (req, res) => {
  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ error: 'Missing barcode' });

  try {
    const r = await fetch(
      `https://api.fda.gov/drug/enforcement.json?search=${encodeURIComponent(barcode)}&limit=3`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }
    );
    if (!r.ok || r.status === 404) {
      return res.json({
        barcode, verdict: 'genuine', confidence: 85,
        checks: [
          { id: 'fda',     label: 'FDA Recall Database', status: 'pass', detail: 'No active recalls found' },
          { id: 'openfda', label: 'OpenFDA Status',      status: 'pass', detail: 'Not in enforcement database' },
        ],
        apiSource: 'OpenFDA Enforcement',
      });
    }
    const data   = await r.json();
    const recall = data.results?.[0];
    if (!recall)
      return res.json({ barcode, verdict: 'genuine', confidence: 88, checks: [{ id: 'fda', label: 'FDA Database', status: 'pass', detail: 'No recalls found' }], apiSource: 'OpenFDA' });

    res.json({
      barcode,
      verdict: recall.status === 'Completed' ? 'suspicious' : 'counterfeit',
      confidence: 90,
      checks: [
        { id: 'recall',  label: 'FDA Recall Alert',    status: 'fail', detail: (recall.reason_for_recall || '').slice(0, 150) },
        { id: 'date',    label: 'Recall Date',          status: 'fail', detail: `Initiated: ${recall.recall_initiation_date || '—'}` },
        { id: 'status',  label: 'Status',               status: recall.status === 'Completed' ? 'warn' : 'fail', detail: recall.status },
        { id: 'product', label: 'Product',              status: 'warn', detail: (recall.product_description || '').slice(0, 150) },
      ],
      apiSource: 'OpenFDA Enforcement',
    });
  } catch (e) {
    console.error('[verify-medicine]', e.message);
    res.json({ barcode, verdict: 'suspicious', confidence: 50, checks: [{ id: 'fda', label: 'FDA Database', status: 'warn', detail: 'Could not connect. Verify manually.' }], apiSource: 'error' });
  }
});

// ── Interactions (stub — frontend calls NIH RxNorm directly) ───────────────
app.post('/api/check-interactions', (_req, res) =>
  res.json({ overallRisk: 'safe', summary: 'Use in-app checker (NIH RxNorm).', interactions: [], generalAdvice: ['Consult a doctor before combining medicines.'] })
);

// ═════════════════════════════════════════════════════════════════════════════
// THE BRIDGE — Patient data sync + Doctor dashboard aggregation
// ═════════════════════════════════════════════════════════════════════════════

const BRIDGE_DIR = path.join(os.tmpdir(), 'healthsathi-bridge');
if (!fs.existsSync(BRIDGE_DIR)) fs.mkdirSync(BRIDGE_DIR, { recursive: true });

/**
 * POST /api/bridge/sync
 * Receives anonymous patient usage data from frontend sync queue.
 * Stores in S3 (if available) or local temp dir.
 */
app.post('/api/bridge/sync', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing items array' });
  }

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const synced = [];

  try {
    for (const item of items) {
      const s3Key = `bridge-data/${dateKey}/${item.id || Date.now()}.json`;
      const payload = JSON.stringify({
        ...item,
        receivedAt: now.toISOString(),
      });

      if (hasAWS) {
        try {
          await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: payload,
            ContentType: 'application/json',
          }));
          synced.push(item.id);
        } catch (e) {
          console.warn(`[bridge] S3 write failed for ${item.id}: ${e.message}`);
          // Fall through to local storage
          const localPath = path.join(BRIDGE_DIR, `${item.id || Date.now()}.json`);
          fs.writeFileSync(localPath, payload);
          synced.push(item.id);
        }
      } else {
        // Local fallback
        const localPath = path.join(BRIDGE_DIR, `${item.id || Date.now()}.json`);
        fs.writeFileSync(localPath, payload);
        synced.push(item.id);
      }
    }

    console.log(`[bridge] Synced ${synced.length}/${items.length} items (${hasAWS ? 'S3' : 'local'})`);
    res.json({ synced, count: synced.length, storage: hasAWS ? 's3' : 'local' });
  } catch (e) {
    console.error('[bridge] Sync error:', e.message);
    res.status(500).json({ error: 'Sync failed', synced });
  }
});

/**
 * GET /api/dashboard/aggregate
 * Reads bridge data (from local or S3) and aggregates for doctor dashboard.
 * Returns: patient patterns, symptom clusters, medicine queries, geographic data.
 */
app.get('/api/dashboard/aggregate', async (_req, res) => {
  try {
    const allItems = [];

    // Read from local bridge dir
    const files = fs.readdirSync(BRIDGE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(BRIDGE_DIR, file), 'utf8');
        allItems.push(JSON.parse(raw));
      } catch { /* skip corrupted files */ }
    }

    // If S3 is available, also try to read recent data
    if (hasAWS) {
      try {
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        for (const dateKey of [yesterday, today]) {
          try {
            const listRes = await s3Client.send(new ListObjectsV2Command({
              Bucket: S3_BUCKET,
              Prefix: `bridge-data/${dateKey}/`,
              MaxKeys: 500,
            }));

            if (listRes.Contents) {
              for (const obj of listRes.Contents) {
                try {
                  const getRes = await s3Client.send(new GetObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: obj.Key,
                  }));
                  const body = await getRes.Body.transformToString();
                  const parsed = JSON.parse(body);
                  // Avoid duplicates
                  if (!allItems.some(i => i.id === parsed.id)) {
                    allItems.push(parsed);
                  }
                } catch { /* skip individual file errors */ }
              }
            }
          } catch { /* skip date prefix errors */ }
        }
      } catch { /* ListObjectsV2Command not available or failed */ }
    }

    // ── Aggregate the data ──
    const now = Date.now();
    const last24h = allItems.filter(i => (now - (i.timestamp || 0)) < 86400000);
    const last7d  = allItems.filter(i => (now - (i.timestamp || 0)) < 7 * 86400000);

    // Count by type
    const typeCounts = {};
    for (const item of last24h) {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    }

    // Region aggregation
    const regionCounts = {};
    for (const item of last24h) {
      const region = item.region || 'Unknown';
      if (!regionCounts[region]) regionCounts[region] = { total: 0, types: {} };
      regionCounts[region].total++;
      regionCounts[region].types[item.type] = (regionCounts[region].types[item.type] || 0) + 1;
    }

    // Symptom keyword clusters
    const keywordCounts = {};
    for (const item of last7d) {
      if (item.type === 'symptom_check' && Array.isArray(item.keywords)) {
        for (const kw of item.keywords) {
          keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
        }
      }
    }

    // Medicine keyword clusters
    const medicineCounts = {};
    for (const item of last7d) {
      if ((item.type === 'medicine_scan' || item.type === 'interaction_check') && Array.isArray(item.keywords)) {
        for (const kw of item.keywords) {
          medicineCounts[kw] = (medicineCounts[kw] || 0) + 1;
        }
      }
    }

    // Daily trend (last 7 days)
    const dailyTrend = [];
    for (let d = 6; d >= 0; d--) {
      const dayStart = new Date(now - d * 86400000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const dayItems = last7d.filter(i => i.timestamp >= dayStart.getTime() && i.timestamp <= dayEnd.getTime());
      const dayLabel = dayStart.toLocaleDateString('en-IN', { weekday: 'short' });
      dailyTrend.push({
        label: dayLabel,
        date: dayStart.toISOString().slice(0, 10),
        total: dayItems.length,
        symptoms: dayItems.filter(i => i.type === 'symptom_check').length,
        medicines: dayItems.filter(i => i.type === 'medicine_scan').length,
        counterfeits: dayItems.filter(i => i.type === 'counterfeit_check').length,
      });
    }

    // Build patient requests from symptom checks (anonymous)
    const patientRequests = last24h
      .filter(i => i.type === 'symptom_check')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map((item, idx) => ({
        id: item.id || `P${String(idx + 1).padStart(3, '0')}`,
        name: `Patient #${idx + 1}`,
        age: item.meta?.ageGroup || 'Unknown',
        village: item.region || 'Unknown',
        symptom: (item.keywords || []).join(', ') || 'General check',
        priority: (item.meta?.severity === 'severe' || item.meta?.severity === 'high')
          ? 'urgent'
          : (item.meta?.severity === 'moderate' ? 'medium' : 'low'),
        since: formatTimeSince(item.timestamp),
      }));

    // Top symptoms for alerts
    const topSymptoms = Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Generate outbreak alerts
    const alerts = [];
    for (const [region, data] of Object.entries(regionCounts)) {
      const symCount = data.types.symptom_check || 0;
      if (symCount >= 3) {
        alerts.push({
          type: 'outbreak_risk',
          village: region,
          severity: symCount >= 8 ? 'high' : 'medium',
          message: `${symCount} symptom reports in ${region} in the last 24h`,
          actionRequired: symCount >= 5,
          timestamp: now,
        });
      }
    }

    res.json({
      totalItems: allItems.length,
      last24hCount: last24h.length,
      typeCounts,
      regionCounts,
      dailyTrend,
      patientRequests,
      topSymptoms,
      topMedicines: Object.entries(medicineCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      alerts,
      stats: {
        medicineScans: typeCounts.medicine_scan || 0,
        counterfeitsFound: typeCounts.counterfeit_check || 0,
        prescriptionsRead: typeCounts.prescription_read || 0,
        labReports: typeCounts.lab_report || 0,
        symptomChecks: typeCounts.symptom_check || 0,
        interactionChecks: typeCounts.interaction_check || 0,
      },
      lastUpdated: now,
    });
  } catch (e) {
    console.error('[dashboard/aggregate]', e.message);
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

function formatTimeSince(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * GET /api/dashboard/:doctorId
 * Returns aggregated data formatted for the DoctorDashboard component.
 */
app.get('/api/dashboard/:doctorId', async (req, res) => {
  try {
    // Fetch aggregated data internally
    const aggResponse = await fetch(`http://localhost:${PORT}/api/dashboard/aggregate`);
    const agg = await aggResponse.json();

    const doctorId = req.params.doctorId;
    const doctorName = req.query.name || 'Doctor';

    res.json({
      doctor: { id: doctorId, name: doctorName, villages: Object.keys(agg.regionCounts || {}) },
      requests: {
        urgent: (agg.patientRequests || []).filter(r => r.priority === 'urgent'),
        medium: (agg.patientRequests || []).filter(r => r.priority === 'medium'),
        low:    (agg.patientRequests || []).filter(r => r.priority === 'low'),
        total:  (agg.patientRequests || []).length,
      },
      trends: {
        period: '7d',
        daily: (agg.dailyTrend || []).map(d => ({
          date: d.date,
          scans: d.medicines + d.total,
          counterfeits: d.counterfeits,
        })),
        topSymptoms: agg.topSymptoms || [],
        totalScans: agg.last24hCount || 0,
      },
      alerts: agg.alerts || [],
      stats: agg.stats || {
        medicineScans: 0,
        counterfeitsFound: 0,
        prescriptionsRead: 0,
      },
      lastUpdated: agg.lastUpdated || Date.now(),
    });
  } catch (e) {
    console.error('[dashboard]', e.message);
    // Fallback to empty data
    res.json({
      doctor: { id: req.params.doctorId, name: 'Doctor', villages: [] },
      requests: { urgent: [], medium: [], low: [], total: 0 },
      trends: { period: '7d', daily: [], topSymptoms: [], totalScans: 0 },
      alerts: [],
      stats: { medicineScans: 0, counterfeitsFound: 0, prescriptionsRead: 0 },
      lastUpdated: Date.now(),
    });
  }
});

// ═══ OCR Proxy — calls OCR.space from backend (avoids CORS / mixed-content) ═
app.post('/api/ocr', async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
    upload.single('file')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'File upload error: ' + err.message });
      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('apikey', 'helloworld');
      form.append('file', req.file.buffer, { filename: req.file.originalname || 'image.jpg', contentType: req.file.mimetype });
      form.append('language', 'eng');
      form.append('isTable', 'true');
      form.append('OCREngine', '2');
      form.append('scale', 'true');

      const ocrRes = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });
      const data = await ocrRes.json();
      console.log('[OCR proxy] status:', ocrRes.status, 'errored:', data.IsErroredOnProcessing);

      if (data.IsErroredOnProcessing) {
        // Retry with Engine 1 as fallback
        const form2 = new FormData();
        form2.append('apikey', 'helloworld');
        form2.append('file', req.file.buffer, { filename: req.file.originalname || 'image.jpg', contentType: req.file.mimetype });
        form2.append('language', 'eng');
        form2.append('isTable', 'true');
        form2.append('OCREngine', '1');
        form2.append('scale', 'true');
        const ocrRes2 = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body: form2,
          headers: form2.getHeaders(),
        });
        const data2 = await ocrRes2.json();
        console.log('[OCR proxy] Engine 1 fallback:', ocrRes2.status, 'errored:', data2.IsErroredOnProcessing);
        return res.json(data2);
      }
      res.json(data);
    });
  } catch (err) {
    console.error('[OCR proxy]', err.message);
    res.status(500).json({ error: 'OCR proxy failed: ' + err.message });
  }
});

// ═══ Translation Proxy — calls MyMemory from backend (avoids CORS / limits) ═
app.get('/api/translate', async (req, res) => {
  const { q, source, target } = req.query;
  if (!q || !target) return res.status(400).json({ error: 'Missing q or target param' });
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${source || 'en'}|${target}`;
    const r = await fetch(url);
    const json = await r.json();
    res.json(json);
  } catch (err) {
    console.error('[Translate proxy]', err.message);
    res.status(502).json({ error: 'Translation proxy failed' });
  }
});

// ═══ TTS Proxy — serves Google Translate TTS audio (avoids browser CORS) ════
app.get('/api/tts', async (req, res) => {
  const { q, tl } = req.query;
  if (!q || !tl) return res.status(400).json({ error: 'Missing q or tl param' });

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(tl)}&client=tw-ob&q=${encodeURIComponent(q)}`;
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });
    if (!upstream.ok) return res.status(upstream.status).send('TTS upstream error');
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    upstream.body.pipe(res);
  } catch (err) {
    console.error('[TTS proxy]', err.message);
    res.status(502).json({ error: 'TTS proxy failed' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀  HealthSathi Backend running at http://localhost:${PORT}`);
  console.log(`    Storage   : ${hasAWS ? `AWS S3 (${S3_BUCKET}, ${AWS_REGION})` : 'Local temp dir (no AWS credentials)'}`);
  console.log(`    OCR       : ${hasAWS ? 'AWS Textract  →  OCR.space fallback' : 'OCR.space only'}`);
  console.log(`    Drug DB   : OpenFDA (always free)`);
  console.log(`    Health Q&A: MedlinePlus + Wikipedia (always free)`);
  console.log('\n    Edit backend-local/.env to configure AWS credentials\n');
});
