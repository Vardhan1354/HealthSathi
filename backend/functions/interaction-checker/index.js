'use strict';
/**
 * DRUG INTERACTION CHECKER
 * AWS Bedrock (Claude 3.5 Sonnet) — uses Claude's medical knowledge for interactions
 * AWS DynamoDB — caches known interaction pairs (7-day TTL)
 */
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { put: dbPut, get: dbGet } = require('/opt/nodejs/db');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ─── CACHE KEY ────────────────────────────────────────────────────────────────

function cacheKey(medicines) {
  return medicines.map(m => m.toLowerCase().trim()).sort().join('+');
}

// ─── BEDROCK INTERACTION CHECK ────────────────────────────────────────────────

async function checkInteractionsWithBedrock(medicines, language = 'en') {
  const langInstruction = {
    hi: 'Respond in Hindi (Devanagari script). Keep medicine names in English.',
    mr: 'Respond in Marathi (Devanagari script). Keep medicine names in English.',
  }[language] || '';

  const prompt = `You are a clinical pharmacist checking drug interactions for a patient in rural India.

Medicines to check: ${medicines.join(', ')}

Provide a JSON response (ONLY JSON, no extra text):
{
  "overallRisk": "safe|caution|avoid",
  "summary": "1-2 sentence plain language summary for the patient",
  "interactions": [
    {
      "pair": ["medicine1", "medicine2"],
      "severity": "major|moderate|minor|none",
      "effect": "what happens when taken together (simple language)",
      "recommendation": "what the patient should do"
    }
  ],
  "generalAdvice": [
    "2-3 general advice points for taking multiple medicines"
  ],
  "seeDoctor": true or false
}

For severity:
- major: potentially life-threatening or causing serious harm — avoid combination
- moderate: may worsen condition — use with caution, consult doctor
- minor: minor effect — monitor but usually safe
- none: no known interaction

${langInstruction}`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  };
  const cmd    = new InvokeModelCommand({ modelId: MODEL_ID, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(payload) });
  const res    = await bedrock.send(cmd);
  const result = JSON.parse(Buffer.from(res.body).toString());
  const text   = result.content[0]?.text || '{}';

  // Parse JSON from Bedrock response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { overallRisk: 'caution', summary: 'Please consult your doctor.', interactions: [], generalAdvice: [], seeDoctor: true };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  const start = Date.now();
  try {
    const { medicines, language = 'en' } = parseBody(event);

    if (!medicines || !Array.isArray(medicines) || medicines.length < 2) {
      return badRequest('medicines must be an array of at least 2 medicine names');
    }
    if (medicines.length > 10) {
      return badRequest('Maximum 10 medicines per check');
    }

    const key = cacheKey(medicines);

    // Check DynamoDB cache (7-day TTL)
    const cached = await dbGet(process.env.TABLE_NAME, `INTERACTION#${key}`, 'RESULT#latest');
    if (cached && cached.ttl > Math.floor(Date.now() / 1000)) {
      await metrics.put('InteractionCacheHit', 1, 'Count');
      return ok({ ...cached.result, fromCache: true });
    }

    // Bedrock analysis
    const interactionResult = await checkInteractionsWithBedrock(medicines, language);
    const latency = Date.now() - start;
    await metrics.put('BedrockCallSuccess', 1, 'Count', { feature: 'interactions' });
    await metrics.put('InteractionLatency', latency, 'Milliseconds');

    const response = { medicines, language, ...interactionResult, model: MODEL_ID, fromCache: false };

    // Cache for 7 days (interaction knowledge doesn't change frequently)
    await dbPut(process.env.TABLE_NAME, {
      PK: `INTERACTION#${key}`,
      SK: 'RESULT#latest',
      result: response,
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 604800,
    });

    return ok(response);

  } catch (err) {
    await metrics.put('InteractionError', 1, 'Count');
    return serverError(err, context);
  }
};
