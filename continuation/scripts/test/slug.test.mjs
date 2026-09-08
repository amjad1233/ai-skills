import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { slugify, stamp, isoStamp, nextFreeName } from '../lib/slug.mjs';
import { makeTempRepo } from './helpers.mjs';

test('slugify lowercases, strips punctuation, caps words, starts with a letter', () => {
  assert.equal(slugify('Stripe Webhook: Verification!'), 'stripe-webhook-verification');
  assert.equal(slugify('one two three four five six seven'), 'one-two-three-four-five');
  assert.equal(slugify('2 factor auth'), 'factor-auth');
  assert.equal(slugify('!!!'), 'record');
});

test('stamp formats local time without separators', () => {
  const d = new Date(2026, 8, 8, 8, 30, 12);
  assert.equal(stamp(d), '2026-09-08T083012');
  assert.equal(isoStamp(d), '2026-09-08T08:30:12');
});

test('nextFreeName appends -2, -3', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    assert.equal(nextFreeName(dir, 'a'), 'a.md');
    fs.writeFileSync(path.join(dir, 'a.md'), '');
    assert.equal(nextFreeName(dir, 'a'), 'a-2.md');
    fs.writeFileSync(path.join(dir, 'a-2.md'), '');
    assert.equal(nextFreeName(dir, 'a'), 'a-3.md');
  } finally { cleanup(); }
});
