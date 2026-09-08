import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { write } from '../lib/commands/write.mjs';
import { parse } from '../lib/frontmatter.mjs';
import { makeTempRepo, writeRecord as fixture } from './helpers.mjs';

test('write creates a record with branch, defaults and rebuilt HOT', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    const { file, id } = write(dir, { type: 'decision', tags: ['stripe', 'webhooks'], summary: 'Use the SDK for signatures', body: '## Context\nx\n## Decision\ny\n## Consequences\nz\n' });
    const d = parse(fs.readFileSync(file, 'utf8')).data;
    assert.equal(d.id, id);
    assert.match(id, /^\d{4}-\d{2}-\d{2}T\d{6}-use-the-sdk-for-signatures$/);
    assert.equal(d.branch, 'main');
    assert.equal(d.confidence, 'medium');
    assert.equal(d.auto, false);
    assert.match(fs.readFileSync(path.join(dir, '.continuation/HOT.md'), 'utf8'), /Use the SDK/);
  } finally { cleanup(); }
});

test('write with supersedes flips the old record and links', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    fixture(dir, 'decision', '2026-09-01T000000-old', {});
    const { file, id } = write(dir, { type: 'decision', tags: ['a'], summary: 'new', body: '## Decision\nx\n', supersedes: '2026-09-01T000000-old' });
    assert.equal(parse(fs.readFileSync(file, 'utf8')).data.supersedes, '2026-09-01T000000-old');
    const old = parse(fs.readFileSync(path.join(dir, '.continuation/decisions/2026-09-01T000000-old.md'), 'utf8')).data;
    assert.equal(old.status, 'superseded');
    assert.equal(old.superseded_by, id);
  } finally { cleanup(); }
});

test('write rejects bad input with a clear error', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    assert.throws(() => write(dir, { type: 'poem', tags: ['a'], summary: 's', body: 'x' }), /type/);
    assert.throws(() => write(dir, { type: 'decision', tags: [], summary: 's', body: 'x' }), /tags/);
  } finally { cleanup(); }
});

test('write rejects a supersedes id that does not exist', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    assert.throws(() => write(dir, { type: 'decision', tags: ['a'], summary: 's', body: 'x', supersedes: '2026-01-01T000000-missing' }), /supersedes: no record/);
    assert.equal(fs.existsSync(path.join(dir, '.continuation/decisions')) && fs.readdirSync(path.join(dir, '.continuation/decisions')).length, 0);
  } finally { cleanup(); }
});
