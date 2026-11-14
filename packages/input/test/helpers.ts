import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const examplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/product/examples');

/** Load a shared contract example (docs/product/examples). These are hand-written expected data. */
export function example<T = any>(file: string): T {
  return JSON.parse(readFileSync(path.join(examplesDir, file), 'utf8')) as T;
}
