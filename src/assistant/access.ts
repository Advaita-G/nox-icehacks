/** The reviewer link carries only a revocable access code; provider credentials never leave the server. */
export async function unlockJudgeLink(url: URL, replace: (url: URL) => void, send: typeof fetch = fetch): Promise<void> {
  const fragment = new URLSearchParams(url.hash.slice(1)), code = fragment.get('judge');
  if (code === null) return;
  fragment.delete('judge'); url.hash = fragment.toString(); replace(url);
  if (code.length < 32 || code.length > 256) throw new Error('This judge access link is invalid. Public local controls remain available.');
  try {
    const response = await send('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin', body: new URLSearchParams({ code }), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Access denied');
    const status = await send('/api/status', { credentials: 'same-origin', signal: AbortSignal.timeout(15_000) });
    if (!status.ok || (await status.json()).accessRequired !== false) throw new Error('Access denied');
  } catch { throw new Error('This judge access link could not unlock live AI. Public local controls remain available.'); }
}
