import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { migrateAll } from '../lib/commands/migrate-all.mjs';
import { makeTempRepo } from './helpers.mjs';

test('migrateAll finds nested repos with old folders and skips the rest', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    for (const name of ['work/a', 'work/b', 'c']) {
      const r = path.join(dir, name);
      fs.mkdirSync(r, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: r });
    }
    fs.mkdirSync(path.join(dir, 'work/a/.claude/continuations'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'work/a/.claude/continuations/2026-01-01-x.md'), '# X\n\n## Next task\nn\n');
    fs.mkdirSync(path.join(dir, 'c/.claude/learnings'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'c/.claude/learnings/2026-01-02-y.md'), '# Y\n\n## Rule\nr\n');
    fs.mkdirSync(path.join(dir, 'work/b/node_modules/z/.claude/continuations'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'c/nested'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: path.join(dir, 'c/nested') });
    fs.mkdirSync(path.join(dir, 'c/nested/.claude/learnings'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'c/nested/.claude/learnings/2026-01-03-z.md'), '# Z\n\n## Rule\nr\n');
    const rows = migrateAll(dir);
    assert.deepEqual(rows.map((r) => [r.repo, r.sessions, r.learnings]).sort(), [['c', 0, 1], ['c/nested', 0, 1], ['work/a', 1, 0]]);
  } finally { cleanup(); }
});
