'use strict';
// AWS Bedrock replaces direct Claude API — no external API key needed
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { ok, badRequest, serverError, parseBody } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
});
const MODEL_ID  = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const MAX_TOKENS = 1500;

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

function buildLabPrompt(text) {
  return `You are a medical expert explaining lab results to a patient in rural India with basic education.

Lab Report Text:
${text}

For each test result, explain in simple language:
1. What:   What this test measures (one sentence)
2. Value:  Whether the value is Normal / Low / High, and by how much
3. Means:  What it means for the patient health (plain language, no jargon)
4. Action: What to do — diet change, rest, follow-up, or see doctor urgently

Format each test as:
TEST: [test name]
STATUS: [Normal / Low / High]
WHAT IT MEANS: [simple explanation]
WHAT TO DO: [clear action]

End with a brief SUMMARY (2-3 lines) — is this report mostly fine, or does it need urgent attention?
Use Hindi/Marathi words in brackets where helpful (e.g. "Haemoglobin (Khoon ka ansh)").
Be warm, reassuring but honest. If urgent, say so clearly.`;
}

function buildPrescriptionPrompt(text) {
  return `You are a helpful medical assistant explaining a prescription to a patient in rural India.

Prescription Text:
${text}

For each medicine, explain:
1. NAME:     Brand name and generic name
2. CATEGORY: What type of medicine it is (antibiotic, painkiller, etc.)
3. WHY:      Likely reason the doctor prescribed it (in simple words)
4. HOW TO TAKE: Exact timing — morning/afternoon/night, before or after food, how many
5. DURATION: How many days
6. WARNINGS: 1-2 important warnings (e.g., complete the full course, avoid alcohol)

Also provide a DAILY SCHEDULE:
Morning (8am): Medicine A after breakfast
Night (9pm): Medicine B after dinner

End with WHEN TO SEE DOCTOR AGAIN — list 2-3 warning signs.
Use simple language. Explain abbreviations (e.g., TDS = 3 times a day).`;
}

const PROMPT_BUILDERS = {
  lab_report:   buildLabPrompt,
  prescription: buildPrescriptionPrompt,
};

// ─── BEDROCK INVOKE ───────────────────────────────────────────────────────────

async function invokeBedrock(prompt) {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  };
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept:      'application/json',
    body:        JSON.stringify(payload),
  });
  const response = await bedrockClient.send(command);
  const result   = JSON.parse(Buffer.from(response.body).toString());
  return {
    text:   result.content[0]?.text || '',
    usage:  result.usage || {},
    model:  result.model || MODEL_ID,
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  const start = Date.now();
  try {
    const { text, type, language = 'en' } = parseBody(event);

    if (!text || text.trim().length < 10)
      return badRequest('text is required (min 10 chars)');
    if (!['lab_report', 'prescription'].includes(type))
      return badRequest('type must be lab_report or prescription');

    let prompt = PROMPT_BUILDERS[type](text);

    if (language === 'hi')
      prompt += '\n\nRespond in Hindi (Devanagari script). Keep medical terms in English with Hindi explanation in brackets.';
    if (language === 'mr')
      prompt += '\n\nRespond in Marathi (Devanagari script). Keep medical terms in English with Marathi explanation in brackets.';

    const { text: explanation, usage } = await invokeBedrock(prompt);
    const latency = Date.now() - start;

    await metrics.put('BedrockCallSuccess', 1, 'Count', { type });
    await metrics.put('BedrockLatency', latency, 'Milliseconds', { type });
    await metrics.put('BedrockInputTokens',  usage.input_tokens  || 0, 'Count');
    await metrics.put('BedrockOutputTokens', usage.output_tokens || 0, 'Count');

    return ok({ explanation, type, model: MODEL_ID, usage });

  } catch (err) {
    await metrics.put('BedrockCallError', 1, 'Count');
    // Bedrock throttling / service error — return graceful fallback
    if (err.name === 'ThrottlingException' || err.$metadata?.httpStatusCode === 429) {
      return ok({
        explanation: null,
        fallback: true,
        error: 'AI service temporarily busy. Please try again in a moment.',
      });
    }
    return serverError(err, context);
  }
};
