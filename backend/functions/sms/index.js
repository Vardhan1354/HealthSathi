'use strict';

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { ok, serverError } = require('/opt/nodejs/response');
const metrics = require('/opt/nodejs/metrics');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// ─── SMS COMMAND REGISTRY ────────────────────────────────────────────────────

const COMMANDS = {
  FEVER: {
    en: "HealthSathi: For fever — Rest, drink fluids, take Paracetamol 500mg. See doctor if fever 3+ days or above 104°F. Call 108 if difficulty breathing.",
    hi: "HealthSathi: बुखार के लिए — आराम करें, पानी पिएं, पेरासिटामोल लें। 3 दिन से अधिक बुखार हो तो डॉक्टर को दिखाएं। सांस में तकलीफ हो तो 108 पर कॉल करें।",
    mr: "HealthSathi: तापासाठी — विश्रांती घ्या, पाणी प्या, पॅरासिटामॉल घ्या। 3+ दिवस ताप असल्यास डॉक्टरकडे जा। श्वास घेण्यास त्रास असल्यास 108 वर फोन करा।",
  },
  MEDICINE: {
    en: "HealthSathi: To verify medicine — Check QR code, spelling on label, price should not be too low. Buy only from licensed pharmacy. Report fakes: 1800-233-1966.",
    hi: "HealthSathi: दवा की जांच करें — QR कोड, लेबल की स्पेलिंग जांचें, कीमत बहुत कम नहीं होनी चाहिए। केवल लाइसेंसी दुकान से खरीदें। नकली दवा रिपोर्ट: 1800-233-1966।",
    mr: "HealthSathi: औषध तपासा — QR कोड, लेबलवरील स्पेलिंग, किंमत खूप कमी नसावी. फक्त परवानाधारक दुकानातून खरेदी करा. बनावट: 1800-233-1966.",
  },
  DOCTOR: {
    en: "HealthSathi: Nearest facilities — PHC Wagholi 3km (020-27290XXX), CHC Lonikand 8km (020-27291XXX), District Hospital 15km. Emergencies: call 108.",
    hi: "HealthSathi: नजदीकी सुविधाएं — PHC वाघोली 3km, CHC लोणीकंद 8km, जिला अस्पताल 15km। आपातकाल: 108 पर कॉल करें।",
    mr: "HealthSathi: जवळची सुविधा — PHC वाघोळी 3km, CHC लोणीकंद 8km, जिल्हा रुग्णालय 15km. आणीबाणी: 108.",
  },
  ORS: {
    en: "HealthSathi: Make ORS at home — mix 1 liter clean water + 6 teaspoons sugar + 1 teaspoon salt. Give every 5 mins for diarrhoea. See doctor if no improvement in 2 hrs.",
    hi: "HealthSathi: ORS बनाएं — 1 लीटर साफ पानी + 6 चम्मच चीनी + 1 चम्मच नमक मिलाएं। दस्त में हर 5 मिनट में दें। 2 घंटे में सुधार न हो तो डॉक्टर को दिखाएं।",
    mr: "HealthSathi: ORS बनवा — 1 लीटर स्वच्छ पाणी + 6 चमचे साखर + 1 चमचा मीठ. जुलाब झाल्यास दर 5 मिनिटांनी द्या. 2 तासात सुधारणा नसल्यास डॉक्टरकडे जा.",
  },
  VACCINE: {
    en: "HealthSathi: Child vaccines are FREE at govt health centres. At birth: BCG, OPV. 6 weeks: Pentavalent, Rotavirus. 9 months: Measles. Carry your immunization card every visit.",
    hi: "HealthSathi: बच्चों के टीके सरकारी केंद्र पर मुफ्त हैं। जन्म: BCG, OPV। 6 सप्ताह: Pentavalent, Rotavirus। 9 महीने: Measles। हर बार टीकाकरण कार्ड साथ लाएं।",
    mr: "HealthSathi: सरकारी केंद्रावर मुलांचे लस मोफत. जन्मावेळी: BCG, OPV. 6 आठवडे: Pentavalent, Rotavirus. 9 महिने: Measles. दरवेळी लसीकरण कार्ड आणा.",
  },
  HELP: {
    en: "HealthSathi commands: FEVER, MEDICINE, DOCTOR, ORS, VACCINE, HELP. Download the app for full features: [app-link]. Helpline: 1800-XXX-XXXX (free).",
    hi: "HealthSathi: FEVER, MEDICINE, DOCTOR, ORS, VACCINE, HELP टाइप करें। पूरी सुविधाओं के लिए ऐप डाउनलोड करें: [app-link]। हेल्पलाइन: 1800-XXX-XXXX (निःशुल्क)।",
    mr: "HealthSathi आदेश: FEVER, MEDICINE, DOCTOR, ORS, VACCINE, HELP. संपूर्ण वैशिष्ट्यांसाठी अॅप डाउनलोड करा: [app-link]. हेल्पलाइन: 1800-XXX-XXXX.",
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function detectLanguage(text) {
  // Rough Unicode range detection
  if (/[\u0900-\u097F]/.test(text)) return 'hi';  // Devanagari
  return 'en';
}

function getResponse(command, lang) {
  const entry = COMMANDS[command];
  if (!entry) {
    const defaults = {
      en: `HealthSathi: Unknown command "${command}". Send HELP for list of commands.`,
      hi: `HealthSathi: अज्ञात आदेश। HELP भेजें।`,
      mr: `HealthSathi: अज्ञात आदेश. HELP पाठवा.`,
    };
    return defaults[lang] || defaults.en;
  }
  return entry[lang] || entry.en;
}

async function sendSms(phone, message) {
  await sns.send(new PublishCommand({
    PhoneNumber: phone,
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
      'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'HlthSathi' },
    },
  }));
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

exports.handler = async (event, context) => {
  try {
    // Accept both API Gateway body and direct invocation
    let phone, message;
    if (event.body) {
      const body = JSON.parse(event.body);
      phone   = body.phone;
      message = body.message;
    } else {
      phone   = event.phone;
      message = event.message;
    }

    if (!phone || !message) return ok({ statusCode: 200 }); // ignore malformed

    const lang    = detectLanguage(message);
    const command = message.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const response = getResponse(command, lang);

    await sendSms(phone, response);
    await metrics.put('SmsSent', 1, 'Count', { command: command || 'UNKNOWN' });

    return ok({ sent: true, command, lang });

  } catch (err) {
    return serverError(err, context);
  }
};
