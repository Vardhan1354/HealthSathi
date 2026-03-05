import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "../services/apiConfig";

// ─── TTS via backend proxy (avoids browser CORS on Google TTS) ──────────────
// Backend GET /api/tts?q=text&tl=lang  →  proxies to Google Translate TTS
// Vite proxy forwards /api/* → http://localhost:3001

// Map i18n language → BCP-47 speech synthesis lang tag (Web Speech API fallback)
const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

/**
 * Strip markdown / formatting characters so TTS reads clean text.
 */
function cleanForSpeech(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[*_~`#>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text into chunks for Google TTS (max ~150 chars per request). */
function splitForTTS(text: string, maxLen = 150): string[] {
  if (!text) return [];
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  // Split on sentence boundaries: . ! ? । (devanagari danda) or newlines
  const sentences = text.split(/(?<=[.!?।\n])\s*/);
  let current = "";
  for (const s of sentences) {
    if (!s.trim()) continue;
    if (current.length + s.length + 1 > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      // If single sentence is too long, hard-split on word boundaries
      if (s.length > maxLen) {
        const words = s.split(/\s+/);
        let buf = "";
        for (const w of words) {
          if (buf.length + w.length + 1 > maxLen) {
            if (buf) chunks.push(buf.trim());
            buf = w;
          } else {
            buf += (buf ? " " : "") + w;
          }
        }
        current = buf;
      } else {
        current = s;
      }
    } else {
      current += (current ? " " : "") + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

interface Props {
  text: string;
  className?: string;
  variant?: "light" | "dark";
}

export default function ReadAloudButton({ text, className = "", variant = "dark" }: Props) {
  const { t, i18n } = useTranslation();
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelRef = useRef(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    cancelRef.current = true;
    // Stop Google TTS audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop Web Speech Synthesis
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    // Clear Chrome keep-alive timer
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    setSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopAll(), [stopAll]);
  // Stop on language change
  useEffect(() => { stopAll(); }, [i18n.language, stopAll]);

  /** Play one chunk via backend TTS proxy (Google Translate TTS audio). */
  function playGoogleChunk(chunk: string, lang: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audioRef.current = audio;
      const q = encodeURIComponent(chunk);
      // Use backend proxy to avoid CORS — Vite proxies /api/* → localhost:3001
      audio.src = apiUrl(`/api/tts?q=${q}&tl=${encodeURIComponent(lang)}`);
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("gtts-error"));
      // Safety timeout: if audio doesn't start playing within 8s, reject
      const timer = setTimeout(() => { audio.pause(); reject(new Error("gtts-timeout")); }, 8000);
      audio.oncanplay = () => clearTimeout(timer);
      audio.play().catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  /** Fallback: Web Speech Synthesis API with Chrome 15-second workaround. */
  function speakWithWebSpeech(fullText: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) { reject(new Error("no-synth")); return; }
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(fullText);
      const langTag = LANG_MAP[i18n.language] ?? "en-IN";
      utter.lang = langTag;
      utter.rate = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang === langTag)
        || voices.find(v => v.lang.startsWith(i18n.language))
        || voices.find(v => v.lang.startsWith("en"))
        || voices[0];
      if (match) utter.voice = match;

      utter.onend = () => {
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        resolve();
      };
      utter.onerror = (e) => {
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        reject(e);
      };

      // Chrome silently stops after ~15s. Workaround: pause/resume every 10s.
      keepAliveRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else if (!window.speechSynthesis.speaking) {
          if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        }
      }, 10000);

      window.speechSynthesis.speak(utter);

      // Safety: if nothing speaks within 3s, resolve (don't hang forever)
      setTimeout(() => {
        if (!window.speechSynthesis.speaking) {
          if (keepAliveRef.current) clearInterval(keepAliveRef.current);
          resolve();
        }
      }, 3000);
    });
  }

  const handleClick = async () => {
    if (speaking) { stopAll(); return; }
    if (!text?.trim()) return;

    const lang = i18n.language || "en";
    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;

    cancelRef.current = false;
    setSpeaking(true);

    // ── Primary: Google Translate TTS audio (best for Hindi/Marathi/English) ──
    try {
      const chunks = splitForTTS(cleaned);
      for (const chunk of chunks) {
        if (cancelRef.current) break;
        await playGoogleChunk(chunk, lang);
      }
      if (!cancelRef.current) setSpeaking(false);
      return; // success — done
    } catch {
      // Google TTS unavailable (offline, blocked, etc.) — try Web Speech
    }

    if (cancelRef.current) return;

    // ── Fallback: Web Speech Synthesis API ──
    try {
      // Wait for voices to load if needed
      if (window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
        await new Promise<void>(resolve => {
          const handler = () => {
            window.speechSynthesis.removeEventListener("voiceschanged", handler);
            resolve();
          };
          window.speechSynthesis.addEventListener("voiceschanged", handler);
          setTimeout(resolve, 2000); // don't wait forever
        });
      }
      await speakWithWebSpeech(cleaned);
    } catch {
      // Both methods failed — silently stop
    }
    if (!cancelRef.current) setSpeaking(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={speaking ? t("stopReading") : t("readAloud")}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
        speaking
          ? "bg-teal-600 border-teal-600 text-white animate-pulse"
          : variant === "light"
            ? "bg-gray-100 border-gray-200 text-gray-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
            : "bg-white/20 border-white/30 text-white hover:bg-white/30",
        className,
      ].join(" ")}
    >
      {speaking ? (
        <>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          {t("stopReading")}
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {t("readAloud")}
        </>
      )}
    </button>
  );
}
