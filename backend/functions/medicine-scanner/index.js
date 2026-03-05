'use strict';
/**
 * MEDICINE SCANNER
 * AWS Rekognition → identify medicine from photo (labels + text)
 * AWS Bedrock (Claude 3.5 Sonnet) → explain category, dosage, usage in local language
 */
const { RekognitionClient, DetectLabelsCommand, DetectTextCommand } = require('@aws-sdk/client-rekognition');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { put: dbPut, get: dbGet } = require('/opt/nodejs/db');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const rek     = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ─── REKOGNITION ──────────────────────────────────────────────────────────────

async function analyzeImage(s3Bucket, s3Key) {
  const image = { S3Object: { Bucket: s3Bucket, Name: s3Key } };
  const [labelsRes, textRes] = await Promise.all([
    rek.send(new DetectLabelsCommand({ Image: image, MaxLabels: 20, MinConfidence: 70 })),
    rek.send(new DetectTextCommand({ Image: image })),
  ]);

  const labels = labelsRes.Labels.map(l => `${l.Name} (${l.Confidence.toFixed(0)}%)`);
  const texts  = textRes.TextDetections
    .filter(t => t.Type === 'LINE' && t.Confidence > 75)
    .map(t => t.DetectedText)
    .slice(0, 20);  // take top 20 lines

  return { labels, texts };
}

// ─── BEDROCK EXPLANATION ──────────────────────────────────────────────────────

async function explainMedicine(imageAnalysis, language = 'en') {
  const langInstruction = {
    hi: 'Respond in Hindi (Devanagari script). Keep medicine names in English.',
    mr: 'Respond in Marathi (Devanagari script). Keep medicine names in English.',
    en: 'Respond in simple English understandable by people with basic education.',
  }[language] || 'Respond in simple English.';

  const prompt = `You are a pharmacist helping a patient in rural India understand their medicine.

Image Analysis from AWS Rekognition:
- Visual Labels: ${imageAnalysis.labels.join(', ')}
- Text Detected on Package: ${imageAnalysis.texts.join(' | ')}

Based on this image analysis, identify the medicine and provide:

1. MEDICINE NAME: What is this medicine? (brand name + generic name if visible)
2. CATEGORY: What type of medicine is it? (e.g., antibiotic, painkiller, vitamin)
3. COMMON USES: What is it commonly used for? (2-3 conditions in simple words)
4. HOW TO TAKE: General guidance (if visible on label — before/after food, frequency)
5. WARNINGS: 2-3 important warnings for this type of medicine
6. STORAGE: How to store it (temperature, keep away from children, etc.)

${langInstruction}

Be practical and clear. If you cannot identify the medicine from the image analysis, say so honestly and suggest the patient show it to a chemist.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  };
  const cmd = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });
  const res    = await bedrock.send(cmd);
  const result = JSON.parse(Buffer.from(res.body).toString());
  return result.content[0]?.text || '';
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  const start = Date.now();
  try {
    const { s3Key, language = 'en' } = parseBody(event);
    if (!s3Key) return badRequest('s3Key is required — upload image to S3 first');

    const uploadBucket = process.env.UPLOAD_BUCKET;
    if (!uploadBucket) return badRequest('UPLOAD_BUCKET env not set');

    // Rekognition: analyse medicine image
    const imageAnalysis = await analyzeImage(uploadBucket, s3Key);
    await metrics.put('RekognitionCallSuccess', 1, 'Count', { feature: 'medicine_scanner' });

    // Bedrock: explain what the medicine is
    const explanation = await explainMedicine(imageAnalysis, language);
    const latency = Date.now() - start;
    await metrics.put('BedrockCallSuccess', 1, 'Count', { feature: 'medicine_scanner' });
    await metrics.put('MedicineScanLatency', latency, 'Milliseconds');

    // Save to DynamoDB for history
    await dbPut(process.env.TABLE_NAME, {
      PK: `SCAN#${Date.now()}`,
      SK: `MEDICINE#${s3Key}`,
      explanation,
      imageLabels: imageAnalysis.labels.slice(0, 5),
      detectedText: imageAnalysis.texts.slice(0, 5),
      language,
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 2592000,  // 30-day TTL
    });

    return ok({
      explanation,
      detectedLabels: imageAnalysis.labels,
      detectedText:   imageAnalysis.texts,
      model: MODEL_ID,
      language,
    });

  } catch (err) {
    await metrics.put('MedicineScanError', 1, 'Count');
    return serverError(err, context);
  }
};
