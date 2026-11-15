import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniformImage } from '../packages/input/src/source/image.ts';

test('only exactly uniform rasters are blank; even faint or single-pixel detail is preserved', () => {
  assert.equal(isUniformImage(new Uint8ClampedArray([255, 254, 247, 255, 255, 254, 247, 255])), true);
  assert.equal(isUniformImage(new Uint8ClampedArray([255, 254, 247, 255, 254, 254, 247, 255])), false);
});
