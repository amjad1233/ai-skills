import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { init } from '../lib/commands/init.mjs';
import { makeTempRepo } from './helpers.mjs';

test('init scaffolds folders, AGENTS.md, gitignore, HOT and INDEX', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    for (const f of ['decisions', 'learnings', 'conventions', 'sessions']) assert.ok(fs.existsSync(path.join(dir, '.continuation', f)));
    assert.match(fs.readFileSync(path.join(dir, '.continuation/AGENTS.md'), 'utf8'), /project memory contract/);
    assert.ok(fs.existsSync(path.join(dir, '.continuation/HOT.md')));
    const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.match(gi, /^\.continuation\/HOT\.md$/m);
    assert.match(gi, /^\.continuation\/INDEX\.md$/m);
  } finally { cleanup(); }
});

test('init is idempotent and preserves an edited AGENTS.md', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    fs.writeFileSync(path.join(dir, '.continuation/AGENTS.md'), 'custom');
    init(dir);
    assert.equal(fs.readFileSync(path.join(dir, '.continuation/AGENTS.md'), 'utf8'), 'custom');
    const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.equal(gi.match(/HOT\.md/g).length, 1);
  } finally { cleanup(); }
});
