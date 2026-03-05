'use strict';
/**
 * PRESCRIPTION READER
 * AWS Textract → OCR handwritten/printed prescription into structured text
 * AWS Bedrock (Claude 3.5 Sonnet) → parse medical abbreviations + explain in plain language
 * AWS Translate → output in en / hi / mr
 */
const { TextractClient, AnalyzeDocumentCommand, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { put: dbPut } = require('/opt/nodejs/db');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const textract = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrock  = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ─── TEXTRACT: OCR PRESCRIPTION ──────────────────────────────────────────────

async function ocrPrescription(s3Bucket, s3Key) {
  // AnalyzeDocument with FORMS extracts key-value pairs (Doctor, Date, Rx lines)
  const cmd = new AnalyzeDocumentCommand({
    Document: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    FeatureTypes: ['FORMS', 'TABLES'],
  });
  const res = await textract.send(cmd);

  // Extract raw text lines
  const lines = res.Blocks
    .filter(b => b.BlockType === 'LINE')
    .map(b => b.Text)
    .join('\n');

  // Extract key-value pairs (e.g., Patient Name, Date)
  const kvPairs = {};
  const keyBlocks = res.Blocks.filter(b => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'));
  for (const key of keyBlocks) {
    const keyText = getBlockText(key, res.Blocks);
    const valBlock = res.Blocks.find(b =>
      b.BlockType === 'KEY_VALUE_SET' &&
      b.EntityTypes?.includes('VALUE') &&
      key.Relationships?.find(r => r.Type === 'VALUE' && r.Ids?.includes(b.Id))
    );
    if (valBlock) kvPairs[keyText] = getBlockText(valBlock, res.Blocks);
  }

  return { rawText: lines, keyValues: kvPairs, confidence: averageConfidence(res.Blocks) };
}

function getBlockText(block, allBlocks) {
  if (!block.Relationships) return '';
  return block.Relationships
    .filter(r => r.Type === 'CHILD')
    .flatMap(r => r.Ids)
    .map(id => allBlocks.find(b => b.Id === id))
    .filter(b => b?.BlockType === 'WORD')
    .map(b => b.Text)
    .join(' ');
}

function averageConfidence(blocks) {
  const conf = blocks.filter(b => b.Confidence).map(b => b.Confidence);
  return conf.length ? (conf.reduce((a, b) => a + b, 0) / conf.length).toFixed(1) : 0;
}

// ─── BEDROCK: PARSE + EXPLAIN ─────────────────────────────────────────────────

async function explainPrescription(ocrResult, language = 'en') {
  const langInstruction = {
    hi: 'Respond in Hindi (Devanagari script). Keep medicine names in English.',
    mr: 'Respond in Marathi (Devanagari script). Keep medicine names in English.',
  }[language] || '';

  const prompt = `You are a helpful pharmacist explaining a prescription to a patient in rural India.

Prescription OCR Text (extracted by AWS Textract):
${ocrResult.rawText}

${Object.keys(ocrResult.keyValues).length ? `Extracted Fields: ${JSON.stringify(ocrResult.keyValues)}` : ''}

For each medicine line, explain:
1. NAME: Brand name + generic name
2. CATEGORY: Type of medicine (antibiotic / painkiller / vitamin / etc.)
3. HOW TO TAKE: Dose — morning/afternoon/night, before or after food, exact quantity
4. DURATION: Number of days
5. PURPOSE: Why this medicine is likely prescribed (in simple words)
6. WARNINGS: 1-2 important warnings

Also provide:
- DAILY SCHEDULE (table format: Morning / Afternoon / Night)
- WHEN TO CALL DOCTOR (2-3 warning signs)

Decode all abbreviations:
OD = once a day, BD = twice a day, TDS = 3 times a day, QID = 4 times a day
AC = before food, PC = after food, HS = at bedtime, SOS = as needed

${langInstruction}
Be clear and practical. If text is unclear, note it honestly.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  };
  const cmd    = new InvokeModelCommand({ modelId: MODEL_ID, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(payload) });
  const res    = await bedrock.send(cmd);
  const result = JSON.parse(Buffer.from(res.body).toString());
  return { explanation: result.content[0]?.text || '', usage: result.usage || {} };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  const start = Date.now();
  try {
    const { s3Key, language = 'en', patientId } = parseBody(event);
    if (!s3Key) return badRequest('s3Key is required — upload prescription image to S3 first');

    const uploadBucket = process.env.UPLOAD_BUCKET;
    if (!uploadBucket) return badRequest('UPLOAD_BUCKET env not set');

    // Step 1: Textract OCR
    const ocrResult = await ocrPrescription(uploadBucket, s3Key);
    await metrics.put('TextractCallSuccess', 1, 'Count', { type: 'prescription' });

    if (!ocrResult.rawText.trim()) {
      return ok({ explanation: null, error: 'Could not extract text. Please take a clearer photo.', ocrConfidence: 0 });
    }

    // Step 2: Bedrock explanation
    const { explanation, usage } = await explainPrescription(ocrResult, language);
    const latency = Date.now() - start;
    await metrics.put('BedrockCallSuccess', 1, 'Count', { feature: 'prescription' });
    await metrics.put('PrescriptionLatency', latency, 'Milliseconds');

    // Step 3: Save to DynamoDB
    const record = {
      PK: patientId ? `PATIENT#${patientId}` : `ANON#${Date.now()}`,
      SK: `PRESCRIPTION#${Date.now()}`,
      rawText: ocrResult.rawText,
      explanation,
      language,
      ocrConfidence: ocrResult.confidence,
      s3Key,
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 2592000,
    };
    await dbPut(process.env.TABLE_NAME, record);

    return ok({
      explanation,
      ocrText:       ocrResult.rawText,
      ocrConfidence: ocrResult.confidence,
      keyValues:     ocrResult.keyValues,
      model:         MODEL_ID,
      language,
      usage,
    });

  } catch (err) {
    await metrics.put('PrescriptionError', 1, 'Count');
    return serverError(err, context);
  }
};
