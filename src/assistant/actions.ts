export interface AssistantReply { message: string; reviewRequired: boolean; changes: string[] }
type Message = string | Promise<string>;
export interface AssistantHost {
  demo(topic?: string): Message;
  run(): Message;
  pause(): Message;
  reset(): Message;
  baseline(): Message;
  compare(): Message;
  save(): Message;
  source(): Message;
  select(name: string): Message;
  create?(name: string): Message;
  interpret?(): Promise<AssistantReply>;
  review(text: string): Promise<AssistantReply>;
  apply(): Message;
  cancel(): Message;
}

const reply = (message: string): AssistantReply => ({ message, reviewRequired: false, changes: [] });
export const normalizeAssistantInput = (text: string) => text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/^(?:hey\s+)?(?:jarvis|nox|knox)[,:]?\s+/, '').replace(/^please\s+|\s+please$/g, '').replace(/\s+/g, ' ');
const cancel = /^(?:no(?:,? thanks)?|cancel(?: (?:it|that|checking|the request|the change|the proposal|the preview))?|stop (?:checking|the request)|never mind|nevermind|discard(?: (?:it|that|the change))?)$/;
const confirm = /^(?:yes(?:,? (?:apply|confirm)(?: it| that| the change| the changes)?)?(?:,? please)?|yeah|yep|apply(?: (?:it|that|the change|the changes|the preview))?|confirm(?: (?:it|that|the change|the changes|the preview))?|go ahead|do it)$/;
const builtin = '(spring(?: cart)?|pendulum|collision|fan)';

export class AssistantActions {
  private tail: Promise<void> = Promise.resolve();
  private epoch = 0;
  private reviewId = 0;
  private pending?: { id: number };
  private awaitingAnswer = false;
  private reviewOpen = false;

  private host: AssistantHost;
  constructor(host: AssistantHost) { this.host = host; }

  handle(input: string): Promise<AssistantReply> {
    if (typeof input !== 'string' || input.trim().length > 4000) return Promise.reject(new Error('Use a command of at most 4000 characters.'));
    const text = normalizeAssistantInput(input), epoch = this.epoch, confirmation = this.pending?.id;
    const answer = this.awaitingAnswer ? this.reviewId : undefined;
    if (!text) return Promise.resolve(reply('Tell me what you would like to do.'));
    if (cancel.test(text)) {
      this.epoch++; this.pending = undefined; this.awaitingAnswer = false; this.reviewOpen = false;
      // Cancellation interrupts a pending request; all other actions remain serialized.
      try { return Promise.resolve(this.host.cancel()).then(reply); }
      catch (error) { return Promise.reject(error); }
    }
    const operation = this.tail.then(() => this.execute(input.trim(), text, epoch, confirmation, answer));
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async execute(input: string, text: string, epoch: number, confirmation?: number, answer?: number): Promise<AssistantReply> {
    if (epoch !== this.epoch) return reply('Cancelled before running.');
    if (confirm.test(text)) {
      if (confirmation !== undefined && this.pending?.id === confirmation) {
        this.pending = undefined; this.awaitingAnswer = false; this.reviewOpen = false; this.reviewId++;
        try { return reply(await this.host.apply()); }
        catch (error) { await this.host.cancel(); throw error; }
      }
      if (/^(?:yes(?:,? please)?|yeah|yep)$/.test(text) && answer !== undefined && this.awaitingAnswer && answer === this.reviewId) return this.review(input, epoch);
      return reply('There is no reviewed change to apply. Wait for the review, then say yes.');
    }
    let action: (() => Message) | undefined;
    if (/^(?:demo|(?:start|run)(?: a| the)? demo|show (?:me )?(?:a demo|what you can do|everything)|take me through it|what can you do|demonstrate(?: what you can do)?)$/.test(text)) action = () => this.host.demo();
    else if (new RegExp(`^(?:show(?: me)?|demonstrate) (?:a |the )?${builtin}(?: demo| experiment| simulation)?$`).test(text)) action = () => this.host.demo(input);
    else if (/^(?:run|start|play|resume|continue)(?: (?:it|the experiment|experiment|the simulation|simulation))?$/.test(text)) action = () => this.host.run();
    else if (/^(?:pause|stop)(?: (?:it|the experiment|experiment|the simulation|simulation))?$/.test(text)) action = () => this.host.pause();
    else if (/^(?:reset|restart)(?: (?:it|the experiment|experiment|the simulation|simulation))?$|^start over$/.test(text)) action = () => this.host.reset();
    else if (/^(?:(?:keep|save|set|remember)(?: this as)?(?: a| the)? )?baseline$/.test(text)) action = () => this.host.baseline();
    else if (/^(?:compare(?: (?:it|with (?:the )?baseline))?|measure|(?:show|open)(?: me)?(?: the)? measurements)$/.test(text)) action = () => this.host.compare();
    else if (/^save(?: (?:it|this experiment|the experiment|experiment|my work))?$/.test(text)) action = () => this.host.save();
    else if (/^(?:source|draw|(?:show|open)(?: me)?(?: the| my| original)? (?:source|sketch|drawing|photo))$/.test(text)) action = () => this.host.source();
    else {
      const selected = /^(?:select|choose|focus on) (?:the )?(.+)$/.exec(text);
      const created = new RegExp(`^(?:create|open|make|build)(?: me)? (?:a |the )?${builtin}(?: experiment| simulation)?$`).exec(text);
      if (selected) action = () => this.host.select(selected[1]!);
      else if (created && this.host.create) action = () => this.host.create!(created[1]!.replace(' cart', ''));
    }
    if (action) {
      const discarded = this.reviewOpen;
      if (discarded) { this.pending = undefined; this.awaitingAnswer = false; this.reviewOpen = false; this.reviewId++; await this.host.cancel(); }
      const message = await action();
      return reply(discarded ? `${message} The earlier unapplied change was cancelled.` : message);
    }
    if (/^(?:build (?:a )?3d preview|interpret (?:my|the) (?:sketch|drawing|photo))$/.test(text) && this.host.interpret) {
      if (this.reviewOpen) await this.host.cancel();
      return this.review(input, epoch, () => this.host.interpret!());
    }
    if (this.awaitingAnswer) return this.review(input, epoch);
    let words = input;
    if (/^(?:double (?:its|the|this) mass|make (?:it|this) twice as heavy)$/.test(text)) words = 'set this mass x2';
    else if (/^halve (?:its|the|this) mass$/.test(text)) words = 'set this mass x0.5';
    else {
      const gravity = /^(?:(?:set|change) (?:the )?)?gravity(?: (?:to|at))? ((?:minus |negative )?-?(?:\d+(?:\.\d+)?|\.\d+))(?: (?:m\/s2|m\/s²|meters per second squared))?$/.exec(text);
      if (gravity) words = `gravity ${gravity[1]!.replace(/^(?:minus|negative) /, '-')}`;
    }
    return this.review(words, epoch);
  }

  private async review(text: string, epoch: number, request = () => this.host.review(text)): Promise<AssistantReply> {
    const id = ++this.reviewId;
    this.pending = undefined; this.awaitingAnswer = false; this.reviewOpen = true;
    try {
      const result = await request();
      if (epoch !== this.epoch || id !== this.reviewId) return reply('The request was cancelled. Nothing was applied.');
      this.pending = result.reviewRequired ? { id } : undefined;
      this.awaitingAnswer = !result.reviewRequired;
      return { ...result, changes: [...result.changes] };
    } catch (error) {
      if (epoch !== this.epoch) return reply('The request was cancelled. Nothing was applied.');
      this.pending = undefined; this.awaitingAnswer = false; this.reviewOpen = false;
      throw error;
    }
  }
}
