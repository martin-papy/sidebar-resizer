import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampSize, parsePx, computeDragSize } from '../scripts/resize-core.js';

test('clampSize returns the value when within bounds', () => {
  assert.equal(clampSize(300, 200, 1200), 300);
});

test('clampSize floors to min when below range', () => {
  assert.equal(clampSize(150, 200, 1200), 200);
});

test('clampSize caps to max when above range', () => {
  assert.equal(clampSize(5000, 200, 1200), 1200);
});

test('clampSize returns min for non-finite input', () => {
  assert.equal(clampSize(NaN, 200, 1200), 200);
  assert.equal(clampSize(Infinity, 200, 1200), 1200);
});

test('clampSize ignores max when max is null', () => {
  assert.equal(clampSize(5000, 200, null), 5000);
});

test('parsePx parses a px string to a number', () => {
  assert.equal(parsePx('320px'), 320);
});

test('parsePx parses a bare numeric string', () => {
  assert.equal(parsePx('320'), 320);
});

test('parsePx passes through a finite number', () => {
  assert.equal(parsePx(440), 440);
});

test('parsePx returns null for non-numeric input', () => {
  assert.equal(parsePx('auto'), null);
  assert.equal(parsePx(''), null);
  assert.equal(parsePx(null), null);
  assert.equal(parsePx(undefined), null);
});

test('computeDragSize grows size as the pointer moves toward a smaller coord', () => {
  // start 300px wide, pointer moved left from x=900 to x=820 → +80
  assert.equal(computeDragSize(300, 900, 820, 200, 1200), 380);
});

test('computeDragSize shrinks size as the pointer moves toward a larger coord', () => {
  // start 300px wide, pointer moved right from x=900 to x=960 → -60
  assert.equal(computeDragSize(300, 900, 960, 200, 1200), 240);
});

test('computeDragSize clamps the result to the given bounds', () => {
  assert.equal(computeDragSize(300, 900, 2000, 200, 1200), 200); // floored
  assert.equal(computeDragSize(300, 900, -600, 200, 1200), 1200); // capped
});

test('computeDragSize rounds to whole pixels', () => {
  assert.equal(computeDragSize(300.4, 900.6, 820.1, 200, 1200), 381);
});
