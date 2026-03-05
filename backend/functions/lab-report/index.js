'use strict';
/**
 * LAB REPORT EXPLAINER
 * AWS Textract → extract text + tables from printed lab reports (PDF / image)
 * AWS Bedrock (Claude 3.5 Sonnet) → explain each test result in plain language
 * AWS Timestream → write health metric time-series for trend analysis
 */
const { TextractClient, AnalyzeDocumentCommand } = require('@aws-sdk/client-textract');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { TimestreamWriteClient, WriteRecordsCommand } = require('@aws-sdk/client-timestream-write');
const { put: dbPut } = require('/opt/nodejs/db');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const textract   = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrock    = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });
const timestream = new TimestreamWriteClient({ region: process.env.AWS_REGION || 'us-east-1' });
const MODEL_ID   = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ─── TEXTRACT: EXTRACT LAB REPORT ────────────────────────────────────────────

async function extractLabReport(s3Bucket, s3Key) {
  // TABLES feature extracts rows/columns (test name | value | unit | reference range)
  const cmd = new AnalyzeDocumentCommand({
    Document: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    FeatureTypes: ['TABLES', 'FORMS'],
  });
  const res = await textract.send(cmd);

  const lines = res.Blocks.filter(b => b.BlockType === 'LINE').map(b => b.Text).join('\n');

  // Extract tables
  const tables = extractTables(res.Blocks);

  return { rawText: lines, tables, confidence: avgConf(res.Blocks) };
}

function extractTables(blocks) {
  const tables = [];
  const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
  for (const table of tableBlocks) {
    const cells = {};
    const cellIds = table.Relationships?.find(r => r.Type === 'CHILD')?.Ids || [];
    for (const id of cellIds) {
      const cell = blocks.find(b => b.Id === id && b.BlockType === 'CELL');
      if (!cell) continue;
      const row = cell.RowIndex;
      const col = cell.ColumnIndex;
      const text = (cell.Relationships?.find(r => r.Type === 'CHILD')?.Ids || [])
        .map(wId => blocks.find(b => b.Id === wId && b.BlockType === 'WORD')?.Text || '')
        .join(' ');
      if (!cells[row]) cells[row] = {};
      cells[row][col] = text;
    }
    tables.push(Object.values(cells).map(row => Object.values(row)));
  }
  return tables;
}

function avgConf(blocks) {
  const c = blocks.filter(b => b.Confidence).map(b => b.Confidence);
  return c.length ? (c.reduce((a, b) => a + b, 0) / c.length).toFixed(1) : 0;
}

// ─── BEDROCK: EXPLAIN RESULTS ─────────────────────────────────────────────────

async function explainLabReport(ocrResult, language = 'en') {
  const langInstruction = {
    hi: 'Respond in Hindi (Devanagari script). Keep test names and values in English.',
    mr: 'Respond in Marathi (Devanagari script). Keep test names and values in English.',
  }[language] || '';

  const tableText = ocrResult.tables.map((t, i) =>
    `Table ${i + 1}:\n${t.map(row => row.join(' | ')).join('\n')}`
  ).join('\n\n');

  const prompt = `You are a doctor explaining a lab report to a patient in rural India with basic education.

Lab Report Text (extracted by AWS Textract):
${ocrResult.rawText}

${tableText ? `Extracted Tables:\n${tableText}` : ''}

For each test result found, explain:
TEST: [test name]
YOUR VALUE: [patient value + unit]
NORMAL RANGE: [reference range]
STATUS: Normal / Low / High / Critical
SIMPLE MEANING: [what this means in 1-2 sentences — no medical jargon]
WHAT TO DO: [diet change / rest / follow up / see doctor urgently]

Use Hindi/Marathi bracket explanations where helpful:
e.g., "Haemoglobin (Khoon ka ansh)", "Blood Sugar (Madhumeh)"

End with:
OVERALL SUMMARY: Is this report mostly fine or does it need urgent attention? (2-3 lines)
NEXT STEPS: 2-3 clear action items for the patient

${langInstruction}`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  };
  const cmd    = new InvokeModelCommand({ modelId: MODEL_ID, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(payload) });
  const res    = await bedrock.send(cmd);
  const result = JSON.parse(Buffer.from(res.body).toString());
  return { explanation: result.content[0]?.text || '', usage: result.usage || {} };
}

// ─── TIMESTREAM: WRITE HEALTH METRICS TIME-SERIES ────────────────────────────

async function writeMetricsToTimestream(patientId, labValues) {
  // labValues = [{ testName: 'Haemoglobin', value: 10.2, unit: 'g/dL', status: 'Low' }]
  if (!labValues.length || !process.env.TIMESTREAM_DB) return;
  const now = BigInt(Date.now());
  const records = labValues.map(lv => ({
    Dimensions: [
      { Name: 'patientId', Value: patientId || 'anonymous' },
      { Name: 'testName',  Value: lv.testName || 'unknown' },
      { Name: 'status',    Value: lv.status    || 'unknown' },
    ],
    MeasureName:  'labValue',
    MeasureValue: String(lv.value ?? 0),
    MeasureValueType: 'DOUBLE',
    Time: String(now),
    TimeUnit: 'MILLISECONDS',
  }));

  try {
    await timestream.send(new WriteRecordsCommand({
      DatabaseName: process.env.TIMESTREAM_DB,
      TableName:    process.env.TIMESTREAM_TABLE || 'HealthMetrics',
      Records: records,
    }));
  } catch (e) {
    // Non-fatal — don't fail the main request
    console.warn('[Timestream] Write failed:', e.message);
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  const start = Date.now();
  try {
    const { s3Key, language = 'en', patientId, text: directText } = parseBody(event);

    const uploadBucket = process.env.UPLOAD_BUCKET;

    // Accept either s3Key (image/PDF) or direct text
    if (!s3Key && !directText) return badRequest('s3Key or text is required');

    let ocrResult;
    if (s3Key && uploadBucket) {
      ocrResult = await extractLabReport(uploadBucket, s3Key);
      await metrics.put('TextractCallSuccess', 1, 'Count', { type: 'lab_report' });
    } else {
      ocrResult = { rawText: directText, tables: [], confidence: 100 };
    }

    if (!ocrResult.rawText.trim()) {
      return ok({ explanation: null, error: 'Could not extract text. Please upload a clearer image.', ocrConfidence: 0 });
    }

    const { explanation, usage } = await explainLabReport(ocrResult, language);
    const latency = Date.now() - start;
    await metrics.put('BedrockCallSuccess', 1, 'Count', { feature: 'lab_report' });
    await metrics.put('LabReportLatency', latency, 'Milliseconds');

    // Async: write to Timestream (best-effort)
    writeMetricsToTimestream(patientId, []).catch(() => {});

    // Save to DynamoDB
    await dbPut(process.env.TABLE_NAME, {
      PK: patientId ? `PATIENT#${patientId}` : `ANON#${Date.now()}`,
      SK: `LAB#${Date.now()}`,
      rawText: ocrResult.rawText,
      explanation,
      language,
      ocrConfidence: ocrResult.confidence,
      s3Key: s3Key || null,
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 2592000,
    });

    return ok({
      explanation,
      ocrText:       ocrResult.rawText,
      ocrConfidence: ocrResult.confidence,
      model:         MODEL_ID,
      language,
      type:          'lab_report',
      usage,
    });

  } catch (err) {
    await metrics.put('LabReportError', 1, 'Count');
    return serverError(err, context);
  }
};
