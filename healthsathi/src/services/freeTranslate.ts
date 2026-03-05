/**
 * Free translation using MyMemory API (https://mymemory.translated.net)
 * - No API key needed
 * - Free tier: 5000 words/day
 * - Supports Hindi (hi) and Marathi (mr)
 *
 * Used as a replacement for AWS Translate — no cost, works in browser.
 */

import { apiUrl } from "./apiConfig";

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

// Map i18n language codes → MyMemory/ISO language codes
const LANG_CODE: Record<string, string> = {
  hi: "hi",  // Hindi
  mr: "mr",  // Marathi
  en: "en",  // English
};

// Cache translations in memory to avoid re-fetching the same text
const cache = new Map<string, string>();

/**
 * Split long text into chunks ≤450 chars (MyMemory recommends <500 chars/request).
 * Splits on sentence boundaries where possible.
 */
function splitIntoChunks(text: string, maxLen = 450): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  // Split on sentence boundaries: period, exclamation, question, devanagari danda |, newlines
  const sentences = text.split(/(?<=[.!?।\n])\s*/);

  let current = "";
  for (const sent of sentences) {
    if (!sent.trim()) continue;
    if (current.length + sent.length + 1 > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = sent;
    } else {
      current += (current ? " " : "") + sent;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any chunk is still too long, hard-split it
  return chunks.flatMap(c =>
    c.length <= maxLen ? [c] : [c.slice(0, maxLen), c.slice(maxLen)]
  );
}

/**
 * Translate a single chunk via MyMemory free API.
 * Returns original text on failure (graceful fallback).
 */
async function translateChunk(text: string, source: string, target: string): Promise<string> {
  const cacheKey = `${source}|${target}|${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // ── Try backend proxy first (avoids CORS/rate-limit issues) ──
  try {
    const proxyUrl = apiUrl(`/api/translate?q=${encodeURIComponent(text)}&source=${source}&target=${target}`);
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const json = await proxyRes.json() as { responseStatus: number; responseData: { translatedText: string } };
      if (json.responseStatus === 200 && json.responseData?.translatedText) {
        const translated = json.responseData.translatedText;
        cache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // Backend proxy unavailable — try direct
  }

  // ── Fallback: direct MyMemory call from browser ──
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const json = await res.json() as { responseStatus: number; responseData: { translatedText: string } };
    if (json.responseStatus === 200 && json.responseData?.translatedText) {
      const translated = json.responseData.translatedText;
      cache.set(cacheKey, translated);
      return translated;
    }
  } catch {
    // Network error / timeout — return original
  }
  return text;
}

/**
 * Translate text to the given target language using MyMemory free API.
 *
 * @param text         - Text to translate
 * @param targetLang   - Target language code: "hi" | "mr" | "en"
 * @param sourceLang   - Source language code: "en" | "auto" (default: "en")
 * @returns Translated text string
 */
export async function freeTranslate(
  text: string,
  targetLang: string,
  sourceLang = "en"
): Promise<string> {
  if (!text.trim()) return text;

  const target = LANG_CODE[targetLang] ?? targetLang;
  const source = sourceLang === "auto" ? "en" : (LANG_CODE[sourceLang] ?? sourceLang);

  // If same language, skip
  if (target === source) return text;

  const chunks = splitIntoChunks(text);

  // Translate chunks sequentially (avoid hammering API)
  const translated: string[] = [];
  for (const chunk of chunks) {
    const result = await translateChunk(chunk, source, target);
    translated.push(result);
    // Small delay between requests to be polite to the free API
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 200));
  }

  return translated.join(" ");
}

/** Language display names for UI buttons */
export const TRANSLATE_LANGS = [
  { code: "hi", label: "हिंदी", full: "Hindi" },
  { code: "mr", label: "मराठी", full: "Marathi" },
];
