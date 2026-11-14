// @vitest-environment jsdom
/**
 * Application-wiring regressions for R4-01 (pending confirmation/question bound to its context)
 * and R4-03 (manual correction must not clear a blocking question). These import the real UI
 * module into jsdom; canvas drawing is a no-op there. They are not browser renders.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.html'), 'utf8');
const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '') ?? '';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const tick = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  document.body.innerHTML = body;
  vi.resetModules();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
  await import('../src/ui/main');
}

function loadFixture(id: 'E-01' | 'E-02') {
  $<HTMLSelectElement>('fixture-select').value = id;
  $('fixture-load').click();
}

function selectObject(id: string) {
  const btn = [...document.querySelectorAll<HTMLButtonElement>('#objects button.item')].find((b) => b.textContent?.startsWith(`${id} `));
  btn?.click();
}

function massOf(id: string): string | undefined {
  selectObject(id);
  return $<HTMLInputElement>('f-mass')?.value;
}

async function typeCommand(text: string) {
  $<HTMLInputElement>('cmd').value = text;
  $('cmd-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await tick();
}

const applyButton = () => document.querySelector<HTMLButtonElement>('#confirm button.primary');

describe('R4-01: a pending confirmation is bound to the scene it was made for', () => {
  beforeEach(boot);

  it('reloading the same example (equal revision) clears it, and a stale Apply changes nothing', async () => {
    loadFixture('E-01');
    await typeCommand('set ball-1 mass 2');
    const staleApply = applyButton();
    expect(staleApply).not.toBeNull();
    loadFixture('E-01'); // replacement scene, also at revision 1
    expect($('confirm').hidden).toBe(true);
    staleApply?.click();
    expect(massOf('ball-1')).toBe('1');
  });

  it('Reset clears a pending confirmation', async () => {
    loadFixture('E-01');
    await typeCommand('set ball-1 mass 2');
    const staleApply = applyButton();
    await typeCommand('reset');
    expect($('confirm').hidden).toBe(true);
    staleApply?.click();
    expect(massOf('ball-1')).toBe('1');
  });

  it('switching to a new experiment and back to an equal-revision scene does not apply it', async () => {
    loadFixture('E-01');
    await typeCommand('set ball-1 mass 2');
    const staleApply = applyButton();
    $('new-experiment').click();
    loadFixture('E-01');
    expect($('confirm').hidden).toBe(true);
    staleApply?.click();
    expect(massOf('ball-1')).toBe('1');
  });

  it('a pending AI command question is discarded when the scene is replaced, and its old option does nothing', async () => {
    loadFixture('E-01');
    // Controlled model reply through the real UI request path (not AI evidence).
    window.fetch = (async (_url: string, init: { body: string }) => {
      const req = JSON.parse(init.body);
      const intent = {
        requestId: req.requestId,
        status: 'needs-clarification',
        targets: ['ball-1', 'cup-1'],
        ops: [],
        question: { id: 'q-amt', kind: 'amount', prompt: 'How far apart?', options: [{ id: 'a', label: 'Twice as far', intentOps: [{ op: 'space-evenly', objectIds: ['ball-1', 'cup-1'], spacing: { factor: 2 } }] }], allowManual: true },
      };
      return { ok: true, status: 200, json: async () => ({ requestId: req.requestId, raw: JSON.stringify(intent) }) };
    }) as unknown as typeof window.fetch;
    await typeCommand('move these farther apart');
    await tick();
    const staleOption = [...document.querySelectorAll<HTMLButtonElement>('#confirm button')].find((b) => b.textContent === 'Twice as far');
    expect(staleOption).toBeDefined();
    loadFixture('E-01');
    expect($('confirm').hidden).toBe(true);
    staleOption?.click();
    expect($('confirm').hidden).toBe(true); // no confirmation offered for the replaced scene
    selectObject('ball-1');
    expect($<HTMLInputElement>('f-x').value).toBe('1.4');
  });

  it('a normal confirmation still applies when nothing changed', async () => {
    loadFixture('E-01');
    await typeCommand('set ball-1 mass 2');
    applyButton()?.click();
    expect(massOf('ball-1')).toBe('2');
  });
});

describe('R4-03: manual correction keeps the question open until a relevant valid edit', () => {
  beforeEach(boot);

  it('choosing manual correction does not resolve the question', () => {
    loadFixture('E-02');
    const manual = [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.includes('correct it manually'));
    manual?.click();
    expect($('question').hidden).toBe(false);
    expect($('question').textContent).toContain('Is the ball resting on the line');
    expect($('run-why').textContent).toContain('Answer 2 questions first');
    const done = [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.startsWith('Done'));
    expect(done?.disabled).toBe(true);
  });

  it('an unrelated edit does not unlock Done; a relevant valid edit does', () => {
    loadFixture('E-02');
    [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.includes('correct it manually'))?.click();
    // Unrelated: change gravity via a typed command applied directly is a voice/typed path; use an add-object instead.
    $<HTMLSelectElement>('add-kind').value = 'block';
    $('add-object').click();
    let done = [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.startsWith('Done'));
    expect(done?.disabled).toBe(true);
    // Relevant: move ball-1 down onto the line.
    selectObject('ball-1');
    const y = $<HTMLInputElement>('f-y');
    y.value = '3.225';
    y.dispatchEvent(new Event('change'));
    done = [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.startsWith('Done'));
    expect(done?.disabled).toBe(false);
    done?.click();
    expect($('question').textContent).toContain('Which object does the arrow');
    expect($('run-why').textContent).toContain('Answer 1 question first');
  });

  it('an invalid edit during correction does not unlock Done', () => {
    loadFixture('E-02');
    [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.includes('correct it manually'))?.click();
    selectObject('ball-1');
    const r = $<HTMLInputElement>('f-restitution');
    r.value = '5';
    r.dispatchEvent(new Event('change'));
    const done = [...document.querySelectorAll<HTMLButtonElement>('#question button')].find((b) => b.textContent?.startsWith('Done'));
    expect(done?.disabled).toBe(true);
  });
});
