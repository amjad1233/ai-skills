import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validate, loadAll, writeRecord, supersede, folderFor } from '../lib/records.mjs';
import { parse } from '../lib/frontmatter.mjs';
import { makeTempRepo, writeRecord as fixture } from './helpers.mjs';

const good = { id: '2026-09-08T083012-a-b', type: 'decision', status: 'active', tags: ['a'], summary: 's' };

test('validate: required fields, enums, tag shape, summary length', () => {
  assert.deepEqual(validate(good), []);
  assert.ok(validate({ ...good, type: 'note' }).some((e) => /type/.test(e)));
  assert.ok(validate({ ...good, tags: [] }).some((e) => /tags/.test(e)));
  assert.ok(validate({ ...good, tags: ['Bad Tag'] }).some((e) => /tags/.test(e)));
  assert.ok(validate({ ...good, tags: ['a','b','c','d','e','f','g'] }).some((e) => /tags/.test(e)));
  assert.ok(validate({ ...good, summary: 'x'.repeat(121) }).some((e) => /summary/.test(e)));
  assert.ok(validate({ ...good, id: 'bad id' }).some((e) => /id/.test(e)));
  assert.ok(validate({ ...good, confidence: 'sure' }).some((e) => /confidence/.test(e)));
});

test('folderFor pluralises', () => {
  assert.equal(folderFor('decision'), 'decisions');
  assert.equal(folderFor('session'), 'sessions');
});

test('loadAll sorts newest first and reports invalid files', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    fixture(dir, 'decision', '2026-09-01T000000-old', {});
    fixture(dir, 'learning', '2026-09-02T000000-new', {});
    fs.writeFileSync(path.join(dir, '.continuation', 'decisions', 'junk.md'), '# no frontmatter\n');
    const { records, invalid } = loadAll(dir);
    assert.deepEqual(records.map((r) => r.data.id), ['2026-09-02T000000-new', '2026-09-01T000000-old']);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].file, /junk\.md$/);
  } finally { cleanup(); }
});

test('writeRecord creates folder, avoids collisions, syncs id', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    const f1 = writeRecord(dir, { ...good }, '## Decision\nx\n');
    const f2 = writeRecord(dir, { ...good }, '## Decision\ny\n');
    assert.match(f1, /decisions\/2026-09-08T083012-a-b\.md$/);
    assert.match(f2, /decisions\/2026-09-08T083012-a-b-2\.md$/);
    assert.equal(parse(fs.readFileSync(f2, 'utf8')).data.id, '2026-09-08T083012-a-b-2');
  } finally { cleanup(); }
});

test('supersede flips the old record', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    const old = fixture(dir, 'decision', '2026-09-01T000000-old', {});
    assert.equal(supersede(dir, '2026-09-01T000000-old', '2026-09-02T000000-new'), true);
    const d = parse(fs.readFileSync(old, 'utf8')).data;
    assert.equal(d.status, 'superseded');
    assert.equal(d.superseded_by, '2026-09-02T000000-new');
    assert.equal(supersede(dir, 'missing', 'x'), false);
  } finally { cleanup(); }
});

test('validate rejects line breaks in scalar fields', () => {
  assert.ok(validate({ ...good, summary: 'a\nb' }).some((e) => /summary: no line breaks/.test(e)));
});

test('loadAll marks records whose filename or folder disagree with frontmatter as invalid', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    fixture(dir, 'decision', '2026-09-01T000000-a', { id: '2026-09-01T000000-b' });
    fixture(dir, 'learning', '2026-09-02T000000-c', { type: 'decision' });
    const { records, invalid } = loadAll(dir);
    assert.equal(records.length, 0);
    assert.equal(invalid.length, 2);
    assert.ok(invalid.some((i) => /must equal filename/.test(i.reasons.join())));
    assert.ok(invalid.some((i) => /must match folder/.test(i.reasons.join())));
  } finally { cleanup(); }
});

test('writeRecord never overwrites an existing file', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    const f1 = writeRecord(dir, { ...good }, 'a\n');
    fs.writeFileSync(f1, 'sentinel');
    writeRecord(dir, { ...good }, 'b\n');
    assert.equal(fs.readFileSync(f1, 'utf8'), 'sentinel');
  } finally { cleanup(); }
});
