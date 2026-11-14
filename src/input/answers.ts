/** A clarification answer sent with a later interpretation or command request. */
export interface Answer { question: string; answer: string }

const key = (question: string) => question.trim().replace(/\s+/g, ' ');

/**
 * Merge newly submitted answers into the earlier ones. A newer answer to the same question
 * replaces the older one (keeping its position), so a corrected answer never reaches the model
 * alongside the value it replaced. Answers to new questions are appended in order.
 */
export function mergeAnswers(previous: readonly Answer[], next: readonly Answer[]): Answer[] {
  const merged = previous.map(a => ({ ...a }));
  for (const a of next) {
    const i = merged.findIndex(m => key(m.question) === key(a.question));
    if (i >= 0) merged[i] = { ...a };
    else merged.push({ ...a });
  }
  return merged;
}
