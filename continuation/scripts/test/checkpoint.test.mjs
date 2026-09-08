import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkpoint } from '../lib/commands/checkpoint.mjs';
import { init } from '../lib/commands/init.mjs';
import { parse } from '../lib/frontmatter.mjs';
import { makeTempRepo, writeRecord } from './helpers.mjs';

test('checkpoint writes an auto session with git state and carried-forward next task', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    writeRecord(dir, 'session', '2026-09-01T000000-prev', { branch: 'main', summary: 'prev' }, '## What was done\n- a\n\n## Next task\nFinish the webhook test\n\n## Key files\n- app/x.php — handler\n');
    fs.writeFileSync(path.join(dir, 'dirty.txt'), 'x');
    const r = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 15, 0) });
    const { data, body } = parse(fs.readFileSync(r.file, 'utf8'));
    assert.equal(data.type, 'session');
    assert.equal(data.auto, true);
    assert.equal(data.confidence, 'low');
    assert.equal(data.summary, 'Auto checkpoint at 09:15');
    assert.ok(data.tags.includes('checkpoint'));
    assert.match(body, /## Current state[\s\S]*\?\? dirty\.txt/);
    assert.match(body, /## Next task\nFinish the webhook test/);
    assert.match(body, /## Key files\n- app\/x\.php — handler/);
  } finally { cleanup(); }
});

test('checkpoint skips when a recent session exists on the branch', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    const first = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 0, 0) });
    assert.ok(first.file);
    const second = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 5, 0) });
    assert.equal(second.skipped, 'recent session on branch');
    const third = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 11, 0) });
    assert.ok(third.file);
  } finally { cleanup(); }
});

test('checkpoint without .continuation/ skips', () => {
  const { dir, cleanup } = makeTempRepo();
  try { assert.equal(checkpoint(dir).skipped, 'not initialised'); } finally { cleanup(); }
});
