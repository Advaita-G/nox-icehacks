import type { RecognitionLike } from '../../packages/input/src/voice/pressToTalk.ts';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
type Recognition = RecognitionLike & { onstart?: (() => void) | null; onspeechstart?: (() => void) | null; onspeechend?: (() => void) | null };
type Synthesis = Pick<SpeechSynthesis, 'speak' | 'cancel'> & Partial<Pick<SpeechSynthesis, 'getVoices' | 'addEventListener' | 'removeEventListener'>>;
interface Visibility { hidden: boolean; addEventListener(type: 'visibilitychange', listener: () => void): void; removeEventListener(type: 'visibilitychange', listener: () => void): void }
export interface VoiceSessionOptions {
  onTranscript(text: string): void | Promise<void>;
  onState(state: VoiceState): void;
  onError(message: string): void;
  /** Real recognizer speech start/end (no audio level is available or implied). */
  onHearing?(active: boolean): void;
  /** A real word boundary of the reply Nox is currently speaking. */
  onWord?(): void;
  recognitionFactory?: (() => Recognition) | null;
  synthesis?: Synthesis | null;
  createUtterance?: ((text: string) => SpeechSynthesisUtterance) | null;
  visibility?: Visibility | null;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

/** start() belongs in an explicit user gesture; browser permission and speech services remain required. */
export class VoiceSession {
  private readonly options: VoiceSessionOptions;
  private readonly factory;
  private readonly synthesis;
  private readonly utterance;
  private readonly visibility;
  private readonly setTimer;
  private readonly clearTimer;
  private recognition: Recognition | null = null;
  private active = false;
  private thinking = false;
  private speaking = false;
  private disposed = false;
  private generation = 0;
  private emptyEnds = 0;
  private state: VoiceState = 'idle';
  private restartTimer: unknown;
  private startTimer: unknown;
  private finishSpeech?: () => void;
  private hearing = false;
  private readonly onVisibility = () => { if (this.visibility?.hidden) this.stop(); };

  constructor(options: VoiceSessionOptions) {
    this.options = options;
    const browser = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    this.factory = options.recognitionFactory === undefined ? Recognition ? () => new Recognition() : null : options.recognitionFactory;
    this.synthesis = options.synthesis === undefined ? globalThis.speechSynthesis : options.synthesis;
    this.utterance = options.createUtterance === undefined ? typeof SpeechSynthesisUtterance === 'undefined' ? null : (text: string) => new SpeechSynthesisUtterance(text) : options.createUtterance;
    this.visibility = options.visibility === undefined ? typeof document === 'undefined' ? null : document : options.visibility;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
    this.visibility?.addEventListener('visibilitychange', this.onVisibility);
  }
  get supported(): boolean { return !!(this.factory && this.synthesis && this.utterance); }
  get isActive(): boolean { return this.active; }
  start(): void {
    if (this.disposed || this.active) return;
    if (!this.supported) { this.fail('Conversational voice is unavailable in this browser. Type your request instead.'); return; }
    if (this.visibility?.hidden) { this.fail('Keep Nox visible to enable voice.'); return; }
    this.active = true; this.thinking = false; this.emptyEnds = 0; this.generation++;
    this.listen();
  }
  stop(): void {
    this.active = false; this.thinking = false; this.generation++;
    this.clearTimer(this.restartTimer); this.restartTimer = undefined;
    this.haltRecognition();
    if (this.finishSpeech) { this.finishSpeech(); this.synthesis?.cancel(); }
    this.setHearing(false);
    this.update('idle');
  }
  dispose(): void { this.stop(); this.disposed = true; this.visibility?.removeEventListener('visibilitychange', this.onVisibility); }
  setThinking(value: boolean): void {
    this.thinking = value;
    if (!this.active) return;
    if (value) { this.clearTimer(this.restartTimer); this.restartTimer = undefined; this.haltRecognition(); if (!this.speaking) this.update('thinking'); }
    else if (!this.speaking) this.restart();
  }
  speak(text: string): Promise<void> {
    if (!this.active || !text.trim()) return Promise.resolve();
    if (this.finishSpeech) { this.finishSpeech(); this.synthesis?.cancel(); }
    this.clearTimer(this.restartTimer); this.restartTimer = undefined;
    this.haltRecognition();
    let speech: SpeechSynthesisUtterance;
    try { speech = this.utterance!(text); }
    catch { this.fail('The browser could not prepare the spoken reply. Continue by typing.'); return Promise.resolve(); }
    speech.lang = 'en-US'; speech.rate = 0.98; speech.pitch = 1;
    this.speaking = true; this.update('speaking');
    return new Promise(resolve => {
      let done = false, voiceTimer: unknown;
      const clearVoiceWait = () => {
        this.clearTimer(voiceTimer); voiceTimer = undefined;
        this.synthesis?.removeEventListener?.('voiceschanged', voicesChanged);
      };
      const speakNow = () => {
        if (done) return;
        clearVoiceWait();
        const voice = this.preferredVoice();
        if (voice) { speech.voice = voice; speech.lang = voice.lang; }
        try { this.synthesis!.speak(speech); }
        catch { this.fail('The browser could not start the spoken reply. Continue by typing.'); }
      };
      const voicesChanged = () => { if (this.preferredVoice()) speakNow(); };
      const timer = this.setTimer(() => this.fail('The spoken reply did not finish. Start voice again, or continue by typing.'), 120_000);
      const finish = () => {
        if (done) return;
        done = true; this.clearTimer(timer); clearVoiceWait(); speech.onend = speech.onerror = null; (speech as { onboundary?: unknown }).onboundary = null;
        this.finishSpeech = undefined; this.speaking = false; resolve();
        if (this.active) { this.update(this.thinking ? 'thinking' : 'idle'); if (!this.thinking) this.restart(); }
      };
      this.finishSpeech = finish;
      speech.onend = finish;
      (speech as SpeechSynthesisUtterance & { onboundary: ((event: { name?: string }) => void) | null }).onboundary = event => { if (!done && this.finishSpeech === finish && (event.name ?? 'word') === 'word') this.options.onWord?.(); };
      speech.onerror = () => this.fail('The browser could not speak the reply. Start voice again, or continue by typing.');
      if (this.preferredVoice() || !this.synthesis?.getVoices) speakNow();
      else {
        // Chromium can expose an empty list until voiceschanged; never block a reply indefinitely.
        if (this.synthesis.addEventListener && this.synthesis.removeEventListener) this.synthesis.addEventListener('voiceschanged', voicesChanged);
        voiceTimer = this.setTimer(speakNow, 750);
        voicesChanged();
      }
    });
  }
  private preferredVoice(): SpeechSynthesisVoice | undefined {
    let english: SpeechSynthesisVoice[];
    try { english = this.synthesis?.getVoices?.().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)) ?? []; }
    catch { return undefined; }
    // The API has no quality metric. Prefer labelled quality voices, then familiar conversational voices.
    return english.find(voice => /natural|neural|premium|enhanced/i.test(`${voice.name} ${voice.voiceURI}`))
      ?? english.find(voice => /google.*english/i.test(voice.name))
      ?? english.find(voice => /^(?:Daniel|Alex)(?:\b|$)/i.test(voice.name))
      ?? english.find(voice => voice.default)
      ?? english.find(voice => /^(?:Samantha|Karen|Moira|Tessa)(?:\b|$)/i.test(voice.name))
      ?? english[0];
  }
  private setHearing(active: boolean): void { if (active !== this.hearing) { this.hearing = active; this.options.onHearing?.(active); } }
  private update(state: VoiceState): void { if (state !== this.state) { this.state = state; this.options.onState(state); } }
  private fail(message: string): void { this.stop(); this.update('error'); this.options.onError(message); }
  private haltRecognition(): void {
    const recognition = this.recognition; this.recognition = null;
    this.clearTimer(this.startTimer); this.startTimer = undefined;
    if (recognition) { recognition.onresult = recognition.onerror = recognition.onend = recognition.onstart = recognition.onspeechstart = recognition.onspeechend = null; try { recognition.abort(); } catch { /* Already ended. */ } }
    this.setHearing(false);
  }
  private restart(): void {
    if (!this.active || this.thinking || this.speaking || this.recognition || this.restartTimer !== undefined) return;
    this.restartTimer = this.setTimer(() => { this.restartTimer = undefined; this.listen(); }, Math.min(5000, 700 * Math.max(1, this.emptyEnds)));
  }
  private listen(): void {
    if (!this.active || this.thinking || this.speaking || this.recognition || this.visibility?.hidden) return;
    let recognition: Recognition;
    try { recognition = this.factory!(); }
    catch { this.fail('The browser could not initialize speech recognition. Type your request instead.'); return; }
    this.recognition = recognition;
    recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => { if (this.recognition === recognition) { this.clearTimer(this.startTimer); this.startTimer = undefined; this.update('listening'); } };
    recognition.onspeechstart = () => { if (this.recognition === recognition && this.active) this.setHearing(true); };
    recognition.onspeechend = () => { if (this.recognition === recognition) this.setHearing(false); };
    recognition.onresult = event => {
      if (this.recognition !== recognition || !this.active) return;
      const text = Array.from(event.results).filter(result => result.isFinal).map(result => result[0]?.transcript.trim() ?? '').filter(Boolean).join(' ');
      if (!text) return;
      this.emptyEnds = 0; this.setThinking(true);
      const generation = this.generation;
      try { Promise.resolve(this.options.onTranscript(text)).catch(() => { if (this.active && generation === this.generation) this.fail('The voice action could not finish. Continue by typing or start voice again.'); }); }
      catch { this.fail('The voice action could not start. Continue by typing or start voice again.'); }
    };
    recognition.onerror = event => {
      if (this.recognition !== recognition || event.error === 'no-speech') return;
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone permission was denied. Allow it in this site’s browser settings, or type your request.',
        'service-not-allowed': 'The browser speech service is not allowed. Check browser settings, or type your request.',
        'audio-capture': 'No working microphone was found. Check your microphone, or type your request.',
        network: 'The browser speech service could not be reached. Type your request or enable voice again later.',
        'language-not-supported': 'The browser speech service does not support this language. Type your request instead.',
        aborted: 'The browser stopped listening. Start voice again when ready.',
      };
      this.fail(messages[event.error] ?? 'Speech recognition failed. Type your request or enable voice again.');
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.recognition = null; this.clearTimer(this.startTimer); this.startTimer = undefined; this.setHearing(false);
      this.emptyEnds++;
      this.update('idle'); this.restart();
    };
    this.startTimer = this.setTimer(() => this.fail('Speech recognition did not start. Check microphone permission and the browser speech service, then start voice again.'), 30_000);
    try { recognition.start(); }
    catch { this.fail('The browser could not start listening. Check microphone permission or type your request.'); }
  }
}
