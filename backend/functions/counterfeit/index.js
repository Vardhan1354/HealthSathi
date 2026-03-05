'use strict';
// AWS Rekognition replaces CDSCO/GS1 external APIs — no outbound HTTP needed
const { RekognitionClient, DetectLabelsCommand, DetectTextCommand } = require('@aws-sdk/client-rekognition');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { put: dbPut, get: dbGet } = require('/opt/nodejs/db');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const rek = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ─── REKOGNITION ANALYSIS ────────────────────────────────────────────────────

async function analyzeImage(s3Bucket, s3Key) {
  const image = { S3Object: { Bucket: s3Bucket, Name: s3Key } };
  const [labelsRes, textRes] = await Promise.all([
    rek.send(new DetectLabelsCommand({ Image: image, MaxLabels: 30, MinConfidence: 60 })),
    rek.send(new DetectTextCommand({ Image: image })),
  ]);

  const labels = labelsRes.Labels.map(l => ({ name: l.Name, confidence: l.Confidence }));
  const texts  = textRes.TextDetections
    .filter(t => t.Type === 'LINE' && t.Confidence > 80)
    .map(t => t.DetectedText);

  return { labels, texts };
}

// ─── BEDROCK COUNTERFEIT ANALYSIS ────────────────────────────────────────────

async function analyzeWithBedrock(imageAnalysis, medicineData) {
  const prompt = `You are a pharmaceutical expert helping verify medicine authenticity in India.

Image Analysis Results:
- Detected Labels: ${imageAnalysis.labels.map(l => `${l.name} (${l.confidence.toFixed(0)}%)`).join(', ')}
- Detected Text: ${imageAnalysis.texts.join(' | ')}

Medicine Information Provided:
- Barcode: ${medicineData.barcode || 'not provided'}
- Has Hologram: ${medicineData.hasHologram ? 'yes' : 'no'}
- Batch Number: ${medicineData.batchNumber || 'not provided'}

Analyze and provide a JSON response with:
{
  "verdict": "genuine|suspicious|counterfeit",
  "confidence": 0-100,
  "checks": [
    {"id": "hologram", "label": "Hologram Seal", "status": "pass|fail|warn", "detail": "explanation"},
    {"id": "label_quality", "label": "Label Quality", "status": "pass|fail|warn", "detail": "explanation"},
    {"id": "text_clarity", "label": "Text & Print Quality", "status": "pass|fail|warn", "detail": "explanation"},
    {"id": "packaging", "label": "Packaging Integrity", "status": "pass|fail|warn", "detail": "explanation"},
    {"id": "barcode", "label": "Barcode Validity", "status": "pass|fail|warn", "detail": "explanation"},
    {"id": "batch", "label": "Batch Number Format", "status": "pass|fail|warn", "detail": "explanation"}
  ],
  "recommendation": "clear action for the patient"
}

Respond with ONLY the JSON, no additional text.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 800,
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
  return JSON.parse(result.content[0].text);
}

// ─── FALLBACK CHECKS (no image provided) ─────────────────────────────────────

function buildBasicChecks(medicineData) {
  return {
    verdict: medicineData.hasHologram ? 'genuine' : 'suspicious',
    confidence: 60,
    checks: [
      { id: 'hologram', label: 'Hologram Seal', status: medicineData.hasHologram ? 'pass' : 'fail', detail: medicineData.hasHologram ? 'Hologram present' : 'Hologram missing or damaged' },
      { id: 'barcode',  label: 'Barcode',       status: medicineData.barcode ? 'pass' : 'warn',     detail: medicineData.barcode ? 'Barcode provided' : 'No barcode entered' },
      { id: 'batch',    label: 'Batch Number',  status: medicineData.batchNumber ? 'pass' : 'warn', detail: medicineData.batchNumber ? 'Batch number present' : 'Batch number not provided' },
      { id: 'label_quality', label: 'Label Quality', status: 'warn', detail: 'Upload an image for visual label analysis' },
      { id: 'text_clarity',  label: 'Text Quality',  status: 'warn', detail: 'Upload an image for text quality check' },
      { id: 'packaging',     label: 'Packaging',     status: 'warn', detail: 'Upload an image for packaging inspection' },
    ],
    recommendation: 'Upload a clear photo of the medicine for more accurate verification.',
  };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  try {
    const body = parseBody(event);
    const { barcode, s3Key, hasHologram = false, batchNumber } = body;
    const uploadBucket = process.env.UPLOAD_BUCKET;

    if (!barcode && !s3Key) return badRequest('barcode or s3Key is required');

    // Check DynamoDB cache (24h TTL)
    if (barcode) {
      const cached = await dbGet(process.env.TABLE_NAME, `MEDICINE#${barcode}`, 'VERIFY#latest');
      if (cached && cached.ttl > Math.floor(Date.now() / 1000)) {
        return ok({ ...cached.result, fromCache: true });
      }
    }

    let result;
    if (s3Key && uploadBucket) {
      // Full AI analysis: Rekognition + Bedrock
      const imageAnalysis = await analyzeImage(uploadBucket, s3Key);
      await metrics.put('RekognitionCallSuccess', 1, 'Count');
      result = await analyzeWithBedrock(imageAnalysis, { barcode, hasHologram, batchNumber });
      await metrics.put('BedrockCallSuccess', 1, 'Count', { feature: 'counterfeit' });
    } else {
      // Basic check without image
      result = buildBasicChecks({ barcode, hasHologram, batchNumber });
    }

    const response = { barcode, ...result, apiSource: s3Key ? 'rekognition+bedrock' : 'rules', fromCache: false };

    // Cache result for 24 h
    if (barcode) {
      await dbPut(process.env.TABLE_NAME, {
        PK: `MEDICINE#${barcode}`, SK: 'VERIFY#latest',
        result: response,
        ttl: Math.floor(Date.now() / 1000) + 86400,
      });
    }

    return ok(response);
  } catch (err) {
    await metrics.put('CounterfeitError', 1, 'Count');
    return serverError(err, context);
  }
};
