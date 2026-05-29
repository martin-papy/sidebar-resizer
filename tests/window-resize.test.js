import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markClassResizable } from '../scripts/window-resize.js';

test('markClassResizable sets resizable on a class with full options', () => {
  const cls = { DEFAULT_OPTIONS: { window: { title: 'X', resizable: false } } };
  assert.equal(markClassResizable(cls), true);
  assert.equal(cls.DEFAULT_OPTIONS.window.resizable, true);
  assert.equal(cls.DEFAULT_OPTIONS.window.title, 'X'); // other keys preserved
});

test('markClassResizable creates window when DEFAULT_OPTIONS lacks it', () => {
  const cls = { DEFAULT_OPTIONS: {} };
  assert.equal(markClassResizable(cls), true);
  assert.equal(cls.DEFAULT_OPTIONS.window.resizable, true);
});

test('markClassResizable creates DEFAULT_OPTIONS when missing', () => {
  const cls = {};
  assert.equal(markClassResizable(cls), true);
  assert.equal(cls.DEFAULT_OPTIONS.window.resizable, true);
});

test('markClassResizable returns false for a missing class', () => {
  assert.equal(markClassResizable(null), false);
  assert.equal(markClassResizable(undefined), false);
});
