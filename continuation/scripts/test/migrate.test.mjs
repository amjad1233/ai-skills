import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { migrateRepo } from '../lib/commands/migrate.mjs';
import { loadAll } from '../lib/records.mjs';
import { makeTempRepo } from './helpers.mjs';

function seed(dir) {
  const c = path.join(dir, '.claude/continuations'); const l = path.join(dir, '.claude/learnings');
  fs.mkdirSync(c, { recursive: true }); fs.mkdirSync(l, { recursive: true });
  fs.writeFileSync(path.join(c, '2026-05-05-ddev-setup.md'), '# Continuation: Proj — DDEV setup\n\n**Session date:** 2026-05-05\n\n## What was completed this session\n- a\n\n## Next task\nDo b\n');
  fs.writeFileSync(path.join(c, '2026-06-21T143052-stripe-webhooks.md'), '# Proj — Stripe webhooks\n\n## What was done this session\n- x\n\n## Next task\nDo y\n');
  fs.writeFileSync(path.join(l, '2026-06-21T143052-stripe-webhooks.md'), '# Learnings — Stripe\n\n## Sig check\n- **Rule:** use sdk\n');
  fs.writeFileSync(path.join(l, '2026-05-05-ddev-gotchas.md'), '# Learnings — DDEV\n\n## Port clash\n- **What happened:** p\n- **Rule:** r\n');
  fs.writeFileSync(path.join(l, 'worktree-and-ddev-gotchas.md'), '# Worktree & DDEV Gotchas\n\nintro\n\n---\n\n## Bug: Composer clobbers autoload\n- **Symptom:** s\n- **Fix:** f\n\n## Bug: Pest parallel DB\n- **Symptom:** s2\n- **Fix:** f2\n');
  fs.writeFileSync(path.join(l, 'notes.txt'), 'ignored');
  fs.symlinkSync(path.join(dir, 'README.md'), path.join(l, '2026-01-01-link.md'));
  execFileSync('git', ['add', '-f', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'seed'], { cwd: dir });
}

test('migrate imports sessions, learnings, splits undated files, idempotent', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    seed(dir);
    const r = migrateRepo(dir);
    assert.equal(r.sessions, 2);
    assert.equal(r.learnings, 2);
    assert.equal(r.skipped, 2);
    assert.equal(r.splits, 2);
    const { records, invalid } = loadAll(dir);
    assert.equal(invalid.length, 0);
    const ids = records.map((x) => x.data.id);
    assert.ok(ids.includes('2026-05-05T000000-ddev-setup'));
    assert.ok(ids.includes('2026-06-21T143052-stripe-webhooks'));
    assert.ok(ids.includes('2026-05-05T000000-ddev-gotchas'));
    assert.equal(records.filter((x) => x.data.id === '2026-06-21T143052-stripe-webhooks').length, 2);
    const split = records.filter((x) => x.data.tags.includes('worktree'));
    assert.equal(split.length, 2);
    assert.ok(split.every((x) => x.data.confidence === 'medium' && x.data.branch === '—'));
    assert.ok(split.some((x) => /composer/.test(x.data.summary.toLowerCase())));
    const ses = records.find((x) => x.data.id === '2026-05-05T000000-ddev-setup');
    assert.match(ses.body, /## What was completed this session/);
    assert.equal(ses.data.summary, 'Proj — DDEV setup');
    assert.ok(fs.existsSync(path.join(dir, '.claude/continuations/2026-05-05-ddev-setup.md')));
    const again = migrateRepo(dir);
    assert.deepEqual([again.sessions, again.learnings, again.splits], [0, 0, 0]);
    assert.equal(loadAll(dir).records.length, records.length);
  } finally { cleanup(); }
});

test('migrate on a repo with nothing to migrate reports zeros', () => {
  const { dir, cleanup } = makeTempRepo();
  try { assert.deepEqual(migrateRepo(dir), { sessions: 0, learnings: 0, splits: 0, skipped: 0, notes: ['nothing to migrate'] }); } finally { cleanup(); }
});
