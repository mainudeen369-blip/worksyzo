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

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = 'en-IN';
  utterance.rate = 1;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang.startsWith('en') && /google|natural|zira|samantha/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
    onEnd?.();
  };
}
