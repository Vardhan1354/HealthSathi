'use strict';
/**
 * HealthSathi – Health Library Lambda
 * POST /api/health-library/ask   → RAG-style Q&A using Amazon Nova Lite
 * GET  /api/health-library/history → Return last N conversation turns
 *
 * Architecture (per hackathon reference design):
 *   User → API Gateway → Lambda → Amazon Bedrock (Nova Lite) → S3 (conversation store)
 *
 * Nova Lite is used here (not Claude 3.5 Sonnet) because:
 *   - Health library Q&A is low-risk, factual retrieval — doesn't need heavy reasoning
 *   - Nova Lite costs ~10× less than Claude 3.5 Sonnet per token
 *   - Demonstrates cost efficiency (hackathon judging criterion 4)
 */

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const REGION           = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
const FAST_MODEL_ID    = process.env.BEDROCK_FAST_MODEL_ID || 'amazon.nova-lite-v1:0';
const CONV_BUCKET      = process.env.CONVERSATIONS_BUCKET;
const ENVIRONMENT      = process.env.ENVIRONMENT || 'prod';

const bedrock = new BedrockRuntimeClient({ region: REGION });
const s3      = new S3Client({ region: process.env.AWS_REGION });
const cw      = new CloudWatchClient({ region: process.env.AWS_REGION });

// ─── Medical knowledge base (embedded — no external KB service needed) ────────
// In production this would be a Bedrock Knowledge Base; for the hackathon demo
// this inline corpus demonstrates the RAG pattern without extra infra cost.
const MEDICAL_CORPUS = `
DIARRHOEA: Caused by bacteria/viruses in dirty water or food. Give ORS immediately (1L clean water + 6 tsp sugar + 1 tsp salt). Wash hands before eating. Boil/filter water. See doctor if: blood in stool, fever above 38°C, no improvement after 2 days.

MALARIA: Symptoms — high fever with chills, headache, body ache, sweating. Spread by Anopheles mosquito at night. Prevention: mosquito nets, repellent, drain stagnant water. Treatment: visit health centre immediately. Complete full medication course.

ANTENATAL CARE: 4 visits minimum during pregnancy. First visit within 3 months — blood tests, tetanus injection. Eat iron-rich foods (leafy vegetables, lentils, eggs). Take iron + folic acid daily. Danger signs: heavy bleeding, severe headache, blurred vision — go to hospital immediately. Deliver at a health facility.

HIGH BLOOD PRESSURE: Normal BP < 120/80 mmHg. High: 140/90+. Risk: salt-heavy diet, stress, smoking, lack of exercise, obesity. Diet: reduce salt, more fruits/vegetables, avoid fried foods. Exercise 30 mins/day. Take BP medicines daily — never stop without doctor. Check BP monthly.

CHILD VACCINATION: At birth — BCG, OPV-0, HepB-1. 6 weeks — OPV-1, Pentavalent-1, Rotavirus-1, PCV-1. 10 weeks — OPV-2, Pentavalent-2. 14 weeks — OPV-3, Pentavalent-3, Rotavirus-3, PCV-3. 9 months — Measles/MR-1. Vaccines are free at government health centres. Always carry immunization card.

DIABETES: Symptoms — increased thirst, frequent urination, blurred vision, fatigue. Fasting blood sugar > 126 mg/dL is diabetic. Diet: avoid sugar and white rice; eat whole grains, vegetables, dal. Walk 30 mins daily. Check blood sugar regularly. Never miss diabetes medicines.

TUBERCULOSIS (TB): Symptoms — persistent cough 2+ weeks, blood in sputum, weight loss, night sweats, fever. Spread by air (coughs/sneezes). Treatment: DOTS therapy 6–9 months. Never stop treatment early — causes drug resistance. Free treatment at government centres.

ANAEMIA: Symptoms — fatigue, pale skin, shortness of breath, dizziness. Caused by iron deficiency. Treatment: iron tablets, iron-rich foods. Pregnant women and children are highest risk. Iron tablets should be taken with vitamin C (lemon juice). Avoid tea/coffee 1 hour before/after iron tablets.

DENGUE: Symptoms — sudden high fever, severe headache, pain behind eyes, joint/muscle pain, rash. No specific medicine — rest, fluids, paracetamol. Do NOT take aspirin or ibuprofen. Go to hospital if bleeding gums, blood in urine/stool, persistent vomiting.

ASTHMA: Symptoms — wheezing, shortness of breath, chest tightness, cough (worse at night). Triggers: dust, smoke, cold air, exercise. Use inhaler as prescribed. Avoid triggers. Seek emergency care if inhaler not helping.

ORS PREPARATION: Mix in 1 litre of clean/boiled water: 6 teaspoons of sugar + 1 teaspoon of salt. Stir until dissolved. Feed small sips frequently. Replace after 24 hours.

HAND WASHING: Wet hands. Apply soap. Scrub all surfaces for 20 seconds. Rinse under clean water. Dry with clean cloth. Critical moments: before eating, after toilet, before feeding a child, after handling garbage.

SAFE WATER: Boil water for 1 minute (rolling boil). Allow to cool — do not add ice. Store in clean covered container. Chlorination tablets available at health centres.

FEVER IN CHILDREN: Give paracetamol (not aspirin for children under 16). Sponge with lukewarm water. Dress lightly. Give extra fluids. Seek care if: fever > 39°C, fever lasting > 3 days, child is less than 3 months old, child has seizures/rash/difficulty breathing.
`;

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(language) {
  const langInstruction = language === 'hi'
    ? 'Respond in Hindi (Devanagari script). Use simple, clear language suitable for rural communities.'
    : language === 'mr'
      ? 'Respond in Marathi (Devanagari script). Use simple, clear language suitable for rural communities.'
      : 'Respond in clear, simple English suitable for rural communities with basic literacy.';

  return `You are HealthSathi, a trusted community health assistant for rural India. 
You help ASHAs (Accredited Social Health Activists), ANMs, patients and their families understand health information.

${langInstruction}

Use the following verified medical knowledge to answer questions:

${MEDICAL_CORPUS}

Rules:
1. Provide ONLY evidence-based health information aligned with Indian public health guidelines (National Health Mission)
2. For any serious or emergency symptoms, always advise the person to visit the nearest health centre or hospital immediately
3. Keep answers concise and practical — suggest simple home actions first, then when to seek care
4. If the question is outside health/medicine scope, politely redirect to health topics
5. Never diagnose or prescribe — only educate and refer
6. For medicines: always say "as prescribed by your doctor"`;
}

// ─── Conversation history S3 helpers ─────────────────────────────────────────
function convKey(sessionId) {
  return `conversations/${sessionId}.json`;
}

async function loadHistory(sessionId) {
  if (!CONV_BUCKET || !sessionId) return [];
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: CONV_BUCKET, Key: convKey(sessionId) }));
    const body = await res.Body.transformToString();
    return JSON.parse(body);
  } catch {
    return [];
  }
}

async function saveHistory(sessionId, messages) {
  if (!CONV_BUCKET || !sessionId) return;
  // Keep last 20 turns to manage token costs
  const trimmed = messages.slice(-20);
  await s3.send(new PutObjectCommand({
    Bucket: CONV_BUCKET,
    Key: convKey(sessionId),
    Body: JSON.stringify(trimmed),
    ContentType: 'application/json',
  }));
}

// ─── Bedrock Nova Lite call ───────────────────────────────────────────────────
async function askNova(systemPrompt, messages) {
  const input = {
    modelId: FAST_MODEL_ID,
    system: [{ text: systemPrompt }],
    messages,
    inferenceConfig: {
      maxTokens: 800,
      temperature: 0.3,
      topP: 0.9,
    },
  };

  const res = await bedrock.send(new ConverseCommand(input));
  return res.output?.message?.content?.[0]?.text || 'Sorry, I could not generate a response.';
}

// ─── CloudWatch metrics ───────────────────────────────────────────────────────
async function putMetric(name, value = 1) {
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: 'HealthSathi',
      MetricData: [{ MetricName: name, Value: value, Unit: 'Count',
        Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }] }],
    }));
  } catch { /* non-fatal */ }
}

// ─── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
};

// ─── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const path = event.path || event.rawPath || '';

  // GET /api/health-library/history
  if (event.httpMethod === 'GET' || event.requestContext?.http?.method === 'GET') {
    const sessionId = event.queryStringParameters?.sessionId;
    if (!sessionId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'sessionId required' }) };
    }
    const history = await loadHistory(sessionId);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ sessionId, messages: history }) };
  }

  // POST /api/health-library/ask
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { question, sessionId, language = 'en' } = body;
  if (!question || question.trim().length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'question is required' }) };
  }

  const t0 = Date.now();

  // Load conversation history
  const history = await loadHistory(sessionId);

  // Append user turn
  const userMessage = { role: 'user', content: [{ text: question.trim() }] };
  const messages = [...history, userMessage];

  // Call Nova Lite
  let answer;
  try {
    const systemPrompt = buildSystemPrompt(language);
    answer = await askNova(systemPrompt, messages);
    await putMetric('NovaLiteCallSuccess');
    await putMetric('NovaLiteLatency', Date.now() - t0);
  } catch (err) {
    console.error('Nova Lite error:', err);
    await putMetric('NovaLiteCallError');
    // Graceful fallback for common topics
    answer = language === 'hi'
      ? 'माफ़ करें, अभी उत्तर देने में समस्या है। कृपया नजदीकी स्वास्थ्य केंद्र से संपर्क करें।'
      : language === 'mr'
        ? 'माफ करा, आत्ता उत्तर देण्यात अडचण आहे. कृपया जवळच्या आरोग्य केंद्राशी संपर्क साधा.'
        : 'Sorry, I am unable to answer right now. Please contact your nearest health centre.';
  }

  // Save updated history
  const assistantMessage = { role: 'assistant', content: [{ text: answer }] };
  const updatedMessages = [...messages, assistantMessage];
  if (sessionId) {
    await saveHistory(sessionId, updatedMessages);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      answer,
      sessionId,
      model: FAST_MODEL_ID,
      language,
      turnCount: updatedMessages.length / 2,
      latencyMs: Date.now() - t0,
    }),
  };
};
