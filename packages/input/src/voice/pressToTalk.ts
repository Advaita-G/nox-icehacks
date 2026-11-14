/**
 * Press-to-talk wrapper over the browser's SpeechRecognition (T3).
 * No continuous listening: recognition runs only while the button/key is held.
 * Browser support and where audio is processed vary (Chrome sends audio to its speech service);
 * the UI must say so. The typed path is always available.
 */

export type VoiceErrorCode = 'UNSUPPORTED' | 'MIC_DENIED' | 'NO_MICROPHONE' | 'NO_SPEECH' | 'TRANSCRIPTION_UNAVAILABLE' | 'ABORTED' | 'UNKNOWN';

export const VOICE_MESSAGES: Record<VoiceErrorCode, string> = {
  UNSUPPORTED: 'This browser has no speech recognition. Type the command instead.',
  MIC_DENIED: 'Microphone permission was denied. Allow it in the browser’s site settings, or type the command.',
  NO_MICROPHONE: 'No microphone was found. Type the command instead.',
  NO_SPEECH: 'No speech was heard. Hold the button while you speak.',
  TRANSCRIPTION_UNAVAILABLE: 'The browser’s speech service is unavailable. Type the command instead.',
  ABORTED: 'Listening stopped.',
  UNKNOWN: 'Speech recognition failed. Type the command instead.',
};

export function mapSpeechError(error: string): VoiceErrorCode {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'MIC_DENIED';
    case 'audio-capture':
      return 'NO_MICROPHONE';
    case 'no-speech':
      return 'NO_SPEECH';
    case 'network':
    case 'language-not-supported':
      return 'TRANSCRIPTION_UNAVAILABLE';
    case 'aborted':
      return 'ABORTED';
    default:
      return 'UNKNOWN';
  }
}

/** Minimal structural type for the parts of SpeechRecognition we use. */
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognitionFactory = () => RecognitionLike;

export function browserRecognitionFactory(): RecognitionFactory | null {
  const w = globalThis as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? () => new Ctor() : null;
}

export interface PressToTalkHandlers {
  onInterim?(text: string): void;
  onFinal(text: string): void;
  onError(code: VoiceErrorCode, message: string): void;
  onStateChange?(listening: boolean): void;
}

export class PressToTalk {
  private rec: RecognitionLike | null = null;
  private finalText = '';
  private interimText = '';
  private errored = false;
  listening = false;

  constructor(
    private readonly factory: RecognitionFactory | null,
    private readonly handlers: PressToTalkHandlers,
    private readonly lang = 'en-US',
  ) {}

  get supported(): boolean {
    return this.factory !== null;
  }

  /** Button/key pressed. */
  press(): void {
    if (this.listening) return;
    if (!this.factory) {
      this.handlers.onError('UNSUPPORTED', VOICE_MESSAGES.UNSUPPORTED);
      return;
    }
    const rec = this.factory();
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    this.finalText = '';
    this.interimText = '';
    this.errored = false;
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r) continue;
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) this.finalText = [this.finalText, text.trim()].filter(Boolean).join(' ');
        else interim = [interim, text.trim()].filter(Boolean).join(' ');
      }
      this.interimText = interim;
      this.handlers.onInterim?.([this.finalText, interim].filter(Boolean).join(' '));
    };
    rec.onerror = (ev) => {
      const code = mapSpeechError(ev.error);
      if (code === 'ABORTED') return;
      this.errored = true;
      this.handlers.onError(code, VOICE_MESSAGES[code]);
    };
    rec.onend = () => {
      const wasListening = this.listening;
      this.listening = false;
      this.rec = null;
      this.handlers.onStateChange?.(false);
      if (this.errored || !wasListening && !this.finalText && !this.interimText) return;
      const text = (this.finalText + ' ' + this.interimText).trim();
      if (text) this.handlers.onFinal(text);
      else this.handlers.onError('NO_SPEECH', VOICE_MESSAGES.NO_SPEECH);
    };
    this.rec = rec;
    this.listening = true;
    this.handlers.onStateChange?.(true);
    try {
      rec.start();
    } catch {
      this.listening = false;
      this.rec = null;
      this.handlers.onStateChange?.(false);
      this.handlers.onError('UNKNOWN', VOICE_MESSAGES.UNKNOWN);
    }
  }

  /** Button/key released: finish and deliver the transcript. */
  release(): void {
    this.rec?.stop();
  }

  /** Esc while listening: discard. */
  cancel(): void {
    if (!this.rec) return;
    this.errored = true; // suppress delivery
    this.rec.abort();
  }
}
