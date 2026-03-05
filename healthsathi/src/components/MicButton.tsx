import { useState, useRef, useEffect } from 'react';
import i18n from '../i18n';

interface ISpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; }
interface ISRErrorEvent extends Event { error: string; }
interface ISpeechRecognition extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null; onend: (() => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror: ((e: ISRErrorEvent) => void) | null;
  start(): void; stop(): void; abort(): void;
}
declare global { interface Window { SpeechRecognition: new () => ISpeechRecognition; webkitSpeechRecognition: new () => ISpeechRecognition; } }

const LANG_MAP: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

function errorMsg(code: string): string {
  switch (code) {
    case 'not-allowed':    return 'Mic blocked — click 🔒 in the address bar and allow Microphone, then try again.';
    case 'no-speech':      return 'No speech detected. Please speak clearly and try again.';
    case 'network':        return 'Speech recognition needs internet. Check your connection and try again.';
    case 'aborted':        return ''; // silent — user or code stopped it
    case 'audio-capture':  return 'No microphone found. Please connect a mic and try again.';
    case 'service-not-allowed': return 'Speech service not allowed. Please allow microphone access in browser settings and reload the page.';
    default:               return `Mic error: ${code}. Please try again.`;
  }
}

interface Props { onResult: (text: string) => void; lang?: string; disabled?: boolean; className?: string; }

export default function MicButton({ onResult, lang, disabled, className = '' }: Props) {
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recRef  = useRef<ISpeechRecognition | null>(null);
  const gotRef  = useRef(false); // true once onresult fired
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount
  useEffect(() => () => {
    recRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const Ctor = (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;
  if (!Ctor) return null;

  const activeLang = lang ?? LANG_MAP[i18n.language] ?? 'en-IN';

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const toggle = () => {
    if (listening) { stop(); return; }

    setMicError(null);
    gotRef.current = false;

    const rec = new Ctor();
    rec.lang            = activeLang;
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      // Auto-stop after 10 s in case onend never fires
      timerRef.current = setTimeout(() => {
        if (!gotRef.current) setMicError('No speech detected. Please try again.');
        stop();
      }, 10_000);
    };

    rec.onresult = (e: ISpeechRecognitionEvent) => {
      gotRef.current = true;
      const text = e.results[0][0].transcript;
      onResult(text);
      stop();
    };

    rec.onerror = (e: ISRErrorEvent) => {
      stop();
      const msg = errorMsg(e.error);
      if (msg) setMicError(msg);
    };

    rec.onend = () => {
      setListening(false);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setMicError('Could not start microphone. Please reload the page and try again.');
    }
  };

  return (
    <div className='inline-flex flex-col items-center gap-1'>
      <button
        type='button'
        onClick={toggle}
        disabled={disabled}
        title={listening ? 'Tap to stop' : 'Tap to speak'}
        className={[
          "flex items-center justify-center w-9 h-9 rounded-xl border transition-all disabled:opacity-40",
          listening
            ? "bg-rose-500 border-rose-500 text-white animate-pulse shadow-lg"
            : "bg-slate-100 border-slate-200 text-slate-400 hover:bg-teal-50 hover:border-teal-400 hover:text-teal-600",
          className,
        ].join(' ')}
      >
        {listening ? (
          // Stop icon when recording
          <svg className='w-4 h-4' viewBox='0 0 24 24' fill='currentColor'>
            <rect x='6' y='6' width='12' height='12' rx='2' />
          </svg>
        ) : (
          // Mic icon when idle
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2}
              d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' />
          </svg>
        )}
      </button>

      {micError && (
        <span className='text-xs text-rose-500 max-w-[200px] text-center leading-tight'>
          {micError}
          <button
            className='block mx-auto mt-0.5 text-teal-600 underline text-xs'
            onClick={() => setMicError(null)}
          >
            Dismiss
          </button>
        </span>
      )}
    </div>
  );
}
