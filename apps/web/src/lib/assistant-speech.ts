/** Strip markdown so TTS reads naturally. */
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[#?\d+\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  );
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: { [index: number]: { transcript: string } | undefined } | undefined;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FEMALE_HINT =
  /female|woman|zira|samantha|hazel|karen|susan|veena|priya|natasha|jenny|aria|sara|linda|heera|lekha|neerja|sonia|emma|lisa|amy|joanna|victoria/i;
const MALE_HINT = /\bmale\b|david|mark|guy|ravi|james|daniel|george|ryan|alex\b/i;

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));

  const ranked = en
    .map((voice) => {
      let score = 0;
      const name = voice.name;
      const lang = voice.lang.toLowerCase();

      if (FEMALE_HINT.test(name)) score += 50;
      if (MALE_HINT.test(name)) score -= 40;
      if (lang.startsWith('en-in')) score += 12;
      if (lang.startsWith('en-gb')) score += 8;
      if (/google.*english.*female/i.test(name)) score += 30;
      if (/microsoft.*zira|microsoft.*heera|microsoft.*hazel/i.test(name)) score += 28;
      if (voice.default && FEMALE_HINT.test(name)) score += 5;

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked.find((r) => r.score > 0)?.voice;
  if (best) return best;

  return en.find((v) => !MALE_HINT.test(v.name)) ?? en[0];
}

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve([]);
  }

  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const finish = () => resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.onvoiceschanged = finish;
      setTimeout(finish, 250);
    });
  }
  return voicesReady;
}

export interface ListenOptions {
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
}

export function listenOnce(options: ListenOptions = {}): Promise<string> {
  const Recognition = getSpeechRecognition();
  if (!Recognition) {
    return Promise.reject(new Error('Speech recognition is not supported in this browser. Use Chrome or Edge.'));
  }

  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = '';

    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const part = event.results[i]?.[0]?.transcript;
        if (part) parts.push(part);
      }
      finalText = parts.join(' ').trim();
      if (finalText) options.onInterim?.(finalText);
    };

    recognition.onerror = (event) => {
      const message =
        event.error === 'not-allowed'
          ? 'Microphone permission denied.'
          : `Voice input failed (${event.error}).`;
      options.onError?.(message);
      reject(new Error(message));
    };

    recognition.onend = () => {
      if (finalText.trim()) {
        resolve(finalText.trim());
      } else {
        reject(new Error('No speech detected. Try again.'));
      }
    };

    try {
      recognition.start();
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not start microphone.'));
    }
  });
}

export function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): () => void {
  if (!isSpeechSynthesisSupported()) {
    onEnd?.();
    return () => undefined;
  }

  const cleaned = stripMarkdownForSpeech(text);
  if (!cleaned) {
    onEnd?.();
    return () => undefined;
  }

  let cancelled = false;

  void loadVoices().then((voices) => {
    if (cancelled) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = 'en-IN';
    utterance.rate = 0.98;
    utterance.pitch = 1.08;

    const female = pickFemaleVoice(voices);
    if (female) {
      utterance.voice = female;
      utterance.lang = female.lang;
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
  });

  return () => {
    cancelled = true;
    window.speechSynthesis.cancel();
    onEnd?.();
  };
}
