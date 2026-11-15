import test from 'node:test';
import assert from 'node:assert/strict';
import { unlockJudgeAccess, unlockJudgeLink } from '../src/assistant/access.ts';

test('reviewer link removes the code before any request and exchanges it only through the existing same-origin gate', async () => {
  const code = 'synthetic-judge-code-with-32-characters', events = [], url = new URL(`https://nox.example/#view=scene&judge=${code}`);
  await unlockJudgeLink(url, clean => { events.push('clean'); assert.equal(clean.hash, '#view=scene'); assert.ok(!clean.href.includes(code)); }, async (path, options) => {
    assert.equal(events[0], 'clean'); events.push(path);
    assert.equal(options.credentials, 'same-origin'); assert.ok(!path.includes(code));
    if (path === '/api/access') { assert.equal(options.method, 'POST'); assert.equal(options.body.get('code'), code); return new Response('', { status: 200 }); }
    assert.equal(path, '/api/status'); return Response.json({ accessRequired: false });
  });
  assert.deepEqual(events, ['clean', '/api/access', '/api/status']);
});

test('ordinary links make no auth call; invalid and failed links never disclose their code or enable inference', async () => {
  await unlockJudgeLink(new URL('https://nox.example/'), () => assert.fail(), async () => assert.fail());
  let replaced = false;
  await assert.rejects(unlockJudgeLink(new URL('https://nox.example/#judge=short'), () => { replaced = true; }, async () => assert.fail()), /invalid/);
  assert.equal(replaced, true);
  const code = 'private-synthetic-code-with-32-characters';
  try { await unlockJudgeLink(new URL(`https://nox.example/#judge=${code}`), () => {}, async () => { throw new Error(code); }); assert.fail(); }
  catch (error) { assert.match(error.message, /could not unlock/); assert.ok(!error.message.includes(code)); }
});

test('in-page access checks the cookie through server status; rejection or a still-locked status never reports success', async () => {
  const code = 'synthetic-private-code-with-32-characters';
  let calls = 0;
  await assert.rejects(unlockJudgeAccess('short', async () => { calls++; assert.fail(); }), /invalid/);
  assert.equal(calls, 0);
  for (const response of [new Response('', { status: 403 }), Response.json({ accessRequired: true })]) {
    const paths = [];
    await assert.rejects(unlockJudgeAccess(code, async path => { paths.push(path); return path === '/api/access' && response.status !== 403 ? new Response('', { status: 200 }) : response; }), /could not unlock/);
    assert.deepEqual(paths, response.status === 403 ? ['/api/access'] : ['/api/access', '/api/status']);
  }
  await unlockJudgeAccess(` ${code} `, async (path, options) => {
    assert.equal(options.credentials, 'same-origin');
    if (path === '/api/access') { assert.equal(options.body.get('code'), code); return new Response('', { status: 200 }); }
    return Response.json({ accessRequired: false });
  });
});
