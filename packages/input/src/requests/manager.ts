/**
 * Request identity, supersession, cancellation, timeout and stale-result rejection (R-06).
 *
 * Every request captures a TargetToken when sent. A response is accepted only when the
 * request is still the pending one for its kind AND every token field still equals the
 * current value. Any target change should call `invalidate()`, which aborts pending work.
 */
import type { TargetToken } from '../contract/types';

export type RequestKind = 'sketch' | 'command';

export type Outcome<T> =
  | { status: 'accepted'; requestId: string; value: T }
  | { status: 'superseded' | 'cancelled' | 'stale' | 'timeout'; requestId: string; message: string }
  | { status: 'failed'; requestId: string; message: string; error: unknown };

export const DEFAULT_TIMEOUTS: Record<RequestKind, number> = { sketch: 30_000, command: 15_000 };

interface Pending {
  id: string;
  target: TargetToken;
  controller: AbortController;
  /** Why it was aborted, if it was. */
  abortReason?: 'superseded' | 'cancelled' | 'timeout' | 'invalidated';
  invalidatedBy?: string;
}

export function sameTarget(a: TargetToken, b: TargetToken): boolean {
  return (
    a.experimentId === b.experimentId &&
    a.versionId === b.versionId &&
    a.sceneRevision === b.sceneRevision &&
    a.sourceId === b.sourceId &&
    a.sourceRevision === b.sourceRevision &&
    a.epoch === b.epoch
  );
}

export interface RequestManagerOptions {
  timeouts?: Partial<Record<RequestKind, number>>;
  newId?: () => string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class RequestManager {
  private pending = new Map<RequestKind, Pending>();
  private readonly timeouts: Record<RequestKind, number>;
  private readonly newId: () => string;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(
    private readonly currentTarget: () => TargetToken,
    opts: RequestManagerOptions = {},
  ) {
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...opts.timeouts };
    this.newId = opts.newId ?? (() => `req-${globalThis.crypto.randomUUID().slice(0, 8)}`);
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  isPending(kind: RequestKind): boolean {
    return this.pending.has(kind);
  }

  pendingId(kind: RequestKind): string | undefined {
    return this.pending.get(kind)?.id;
  }

  /**
   * Start a request. `run` receives an AbortSignal and the new requestId; its result is
   * accepted only if still current when it resolves.
   */
  async start<T>(
    kind: RequestKind,
    run: (signal: AbortSignal, requestId: string, target: TargetToken) => Promise<T>,
  ): Promise<Outcome<T>> {
    const previous = this.pending.get(kind);
    if (previous) {
      previous.abortReason = 'superseded';
      previous.controller.abort();
    }
    const entry: Pending = { id: this.newId(), target: { ...this.currentTarget() }, controller: new AbortController() };
    this.pending.set(kind, entry);
    const timeoutMs = this.timeouts[kind];
    const timer = this.setTimer(() => {
      if (this.pending.get(kind) === entry) {
        entry.abortReason = 'timeout';
        entry.controller.abort();
      }
    }, timeoutMs);

    const aborted = new Promise<never>((_, reject) => {
      entry.controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    aborted.catch(() => undefined); // observed via Promise.race; avoid unhandled rejection if run settles first

    try {
      const value = await Promise.race([run(entry.controller.signal, entry.id, { ...entry.target }), aborted]);
      return this.settle(kind, entry, value);
    } catch (error) {
      return this.settleError(kind, entry, error, timeoutMs);
    } finally {
      this.clearTimer(timer);
      if (this.pending.get(kind) === entry) this.pending.delete(kind);
    }
  }

  private settle<T>(kind: RequestKind, entry: Pending, value: T): Outcome<T> {
    if (entry.abortReason) return this.abortedOutcome(entry, this.timeouts[kind]);
    if (this.pending.get(kind) !== entry) {
      return { status: 'superseded', requestId: entry.id, message: 'A newer request replaced this one.' };
    }
    if (!sameTarget(entry.target, this.currentTarget())) {
      return { status: 'stale', requestId: entry.id, message: 'A result for an older version was discarded.' };
    }
    return { status: 'accepted', requestId: entry.id, value };
  }

  private settleError<T>(kind: RequestKind, entry: Pending, error: unknown, timeoutMs: number): Outcome<T> {
    if (entry.abortReason) return this.abortedOutcome(entry, timeoutMs);
    if (this.pending.get(kind) !== entry) {
      return { status: 'superseded', requestId: entry.id, message: 'A newer request replaced this one.' };
    }
    const message = error instanceof Error ? error.message : 'The request failed.';
    return { status: 'failed', requestId: entry.id, message, error };
  }

  private abortedOutcome(entry: Pending, timeoutMs: number): Outcome<never> {
    switch (entry.abortReason) {
      case 'superseded':
        return { status: 'superseded', requestId: entry.id, message: 'A newer request replaced this one.' };
      case 'timeout':
        return { status: 'timeout', requestId: entry.id, message: `The model did not respond in ${Math.round(timeoutMs / 1000)} s.` };
      case 'invalidated':
        return { status: 'stale', requestId: entry.id, message: entry.invalidatedBy ?? 'A result for an older version was discarded.' };
      default:
        return { status: 'cancelled', requestId: entry.id, message: 'Cancelled. The provider may still charge for this request.' };
    }
  }

  /** User pressed Cancel. */
  cancel(kind: RequestKind): boolean {
    const p = this.pending.get(kind);
    if (!p) return false;
    p.abortReason = 'cancelled';
    p.controller.abort();
    return true;
  }

  /**
   * The target changed (edit, stroke, reset, load, experiment/version switch).
   * Aborts every pending request whose captured target no longer matches.
   * Returns the kinds that were aborted.
   */
  invalidate(message: string): RequestKind[] {
    const now = this.currentTarget();
    const aborted: RequestKind[] = [];
    for (const [kind, p] of this.pending) {
      if (!sameTarget(p.target, now)) {
        p.abortReason = 'invalidated';
        p.invalidatedBy = message;
        p.controller.abort();
        aborted.push(kind);
      }
    }
    return aborted;
  }
}
