import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { repoRoot, branch, snapshot, firstCommitDate } from '../lib/git.mjs';
import { makeTempRepo } from './helpers.mjs';

test('repoRoot and branch inside a repo', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    assert.equal(fs.realpathSync(repoRoot(dir)), fs.realpathSync(dir));
    assert.equal(branch(dir), 'main');
  } finally { cleanup(); }
});

test('outside a repo: root null, branch em dash, snapshot empty', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    assert.equal(repoRoot(dir), null);
    assert.equal(branch(dir), '—');
    assert.deepEqual(snapshot(dir), { branch: '—', status: '', log: '', diffStat: '' });
  } finally { cleanup(); }
});

test('snapshot and firstCommitDate', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
    const s = snapshot(dir);
    assert.match(s.status, /\?\? a\.txt/);
    assert.match(s.log, /init/);
    assert.ok(firstCommitDate(dir, 'README.md') instanceof Date);
    assert.equal(firstCommitDate(dir, 'a.txt'), null);
  } finally { cleanup(); }
});
