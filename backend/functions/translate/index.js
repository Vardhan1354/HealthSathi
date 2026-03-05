'use strict';
/**
 * TRANSLATE & SPEAK
 * AWS Translate  → real-time text translation (en ↔ hi ↔ mr)
 * AWS Polly      → text-to-speech in Hindi / Marathi / English
 * AWS S3         → cache generated audio files (30-day lifecycle)
 *
 * POST /api/translate → { text, targetLanguage } → { translatedText }
 * POST /api/speak     → { text, language }        → { audioUrl, audioBase64 }
 */
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { PollyClient, SynthesizeSpeechCommand, DescribeVoicesCommand } = require('@aws-sdk/client-polly');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const translateClient = new TranslateClient({ region: process.env.AWS_REGION || 'us-east-1' });
const pollyClient     = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client        = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Language → Polly voice mapping (Indian voices where available)
const POLLY_VOICES = {
  hi: 'Aditi',      // Hindi (India) — neural available
  mr: 'Aditi',      // Marathi — use Hindi voice as fallback (Polly has no dedicated Marathi)
  en: 'Raveena',    // English (India)
  ta: 'Aditi',      // Tamil fallback
};

// Language codes for AWS Translate
const LANG_CODES = {
  en: 'en',
  hi: 'hi',
  mr: 'mr',
  ta: 'ta',
  te: 'te',
  kn: 'kn',
  bn: 'bn',
};

// ─── TRANSLATE ────────────────────────────────────────────────────────────────

async function translateText(text, targetLang, sourceLang = 'auto') {
  const cmd = new TranslateTextCommand({
    Text: text,
    SourceLanguageCode: sourceLang === 'auto' ? 'auto' : (LANG_CODES[sourceLang] || sourceLang),
    TargetLanguageCode: LANG_CODES[targetLang] || targetLang,
  });
  const res = await translateClient.send(cmd);
  return {
    translatedText:      res.TranslatedText,
    detectedSourceLang:  res.AppliedTerminologies?.[0] || res.SourceLanguageCode,
  };
}

// ─── POLLY TTS ────────────────────────────────────────────────────────────────

async function synthesizeSpeech(text, language = 'en') {
  const voiceId = POLLY_VOICES[language] || 'Raveena';

  // Truncate to Polly limit (3000 chars)
  const truncated = text.length > 3000 ? text.slice(0, 3000) + '...' : text;

  const cmd = new SynthesizeSpeechCommand({
    Text:         truncated,
    VoiceId:      voiceId,
    OutputFormat: 'mp3',
    Engine:       'standard',   // 'neural' if voiceId supports it
    LanguageCode: language === 'hi' || language === 'mr' ? 'hi-IN' : 'en-IN',
  });
  const res = await pollyClient.send(cmd);

  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of res.AudioStream) chunks.push(chunk);
  return { audioBuffer: Buffer.concat(chunks), voiceId };
}

// ─── S3 AUDIO CACHE ───────────────────────────────────────────────────────────

async function cacheAudio(audioBuffer, cacheKey) {
  const bucket = process.env.CONTENT_BUCKET;
  if (!bucket) return null;

  const s3Key = `audio/${cacheKey}.mp3`;
  await s3Client.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         s3Key,
    Body:        audioBuffer,
    ContentType: 'audio/mpeg',
  }));

  // Generate 1-hour pre-signed URL
  const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: s3Key }), { expiresIn: 3600 });
  return { s3Key, audioUrl: url };
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────

async function handleTranslate(body) {
  const { text, targetLanguage, sourceLanguage = 'auto' } = body;
  if (!text)           return badRequest('text is required');
  if (!targetLanguage) return badRequest('targetLanguage is required (en/hi/mr)');
  if (text.length > 10000) return badRequest('text too long — max 10000 chars');

  const result = await translateText(text, targetLanguage, sourceLanguage);
  await metrics.put('TranslateCallSuccess', 1, 'Count', { targetLang: targetLanguage });

  return ok({ ...result, targetLanguage, sourceLanguage, charCount: text.length });
}

async function handleSpeak(body) {
  const { text, language = 'en' } = body;
  if (!text) return badRequest('text is required');
  if (text.length > 5000) return badRequest('text too long — max 5000 chars for speech');

  const { audioBuffer, voiceId } = await synthesizeSpeech(text, language);
  await metrics.put('PollyCallSuccess', 1, 'Count', { language });

  // Cache audio in S3
  const cacheKey = require('crypto').createHash('md5').update(`${language}:${text.slice(0, 100)}`).digest('hex');
  const cached   = await cacheAudio(audioBuffer, cacheKey).catch(() => null);

  return ok({
    audioUrl:    cached?.audioUrl || null,
    audioBase64: audioBuffer.toString('base64'),  // inline fallback for small responses
    voiceId,
    language,
    charCount: text.length,
  });
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  try {
    const body    = parseBody(event);
    const path    = event.path || event.resource || '';
    const isSpeak = path.includes('/speak');

    if (isSpeak) return await handleSpeak(body);
    return await handleTranslate(body);

  } catch (err) {
    await metrics.put('TranslateError', 1, 'Count');
    return serverError(err, context);
  }
};
