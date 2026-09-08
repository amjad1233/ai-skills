import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { report } from '../lib/commands/review.mjs';
import { init } from '../lib/commands/init.mjs';
import { makeTempRepo, writeRecord } from './helpers.mjs';

test('review finds candidates, stale files, thin, orphans, chains, old checkpoints', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    writeRecord(dir, 'decision', '2026-09-01T000000-a', { tags: ['stripe', 'webhooks', 'x'], summary: 'use sdk' }, '## Decision\nlong\nenough\nbody\n');
    writeRecord(dir, 'decision', '2026-09-02T000000-b', { tags: ['stripe', 'webhooks', 'y'], summary: 'hand roll hmac' }, '## Decision\nlong\nenough\nbody\n');
    writeRecord(dir, 'learning', '2026-09-03T000000-c', { tags: ['ddev'], files: ['gone/file.php'] }, '## Rule\nx\n');
    writeRecord(dir, 'convention', '2026-09-04T000000-d', { tags: ['pint'], confidence: 'low' }, '## Rule\nlong\nenough\nbody\n');
    for (let i = 1; i <= 4; i++) writeRecord(dir, 'convention', `2026-08-0${i}T000000-chain`, { tags: ['commits'], status: i < 4 ? 'superseded' : 'active', superseded_by: i < 4 ? `2026-08-0${i + 1}T000000-chain` : '—', supersedes: i > 1 ? `2026-08-0${i - 1}T000000-chain` : '—' }, '## Rule\nlong\nenough\nbody\n');
    writeRecord(dir, 'session', '2026-08-20T000000-auto-checkpoint', { tags: ['checkpoint'], auto: true, confidence: 'low', summary: 'Auto checkpoint at 09:00' }, '## What was done\n- auto\n## Next task\n—\n');
    const r = report(dir, { now: new Date(2026, 8, 8) });
    assert.deepEqual(r.conflictCandidates, [['2026-09-02T000000-b', '2026-09-01T000000-a']]);
    assert.ok(r.stale.some((s) => s.id === '2026-09-03T000000-c' && /gone\/file\.php/.test(s.reason)));
    assert.ok(r.thin.some((t) => t.id === '2026-09-04T000000-d' && /low/.test(t.reason)));
    assert.ok(r.thin.some((t) => t.id === '2026-09-03T000000-c' && /short/.test(t.reason)));
    assert.ok(r.thin.some((t) => t.id === '2026-08-20T000000-auto-checkpoint' && /checkpoint/.test(t.reason)));
    assert.ok(r.orphanTags.some((o) => o.tag === 'ddev'));
    assert.ok(!r.orphanTags.some((o) => o.tag === 'stripe'));
    assert.deepEqual(r.chains.map((c) => c.tag), ['commits']);
    assert.equal(r.chains[0].length, 4);
  } finally { cleanup(); }
});

test('review terminates on a supersession cycle', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    writeRecord(dir, 'decision', '2026-09-01T000000-a', { tags: ['x'], supersedes: '2026-09-02T000000-b' });
    writeRecord(dir, 'decision', '2026-09-02T000000-b', { tags: ['x'], supersedes: '2026-09-01T000000-a' });
    const r = report(dir, { now: new Date(2026, 8, 8) });
    assert.deepEqual(r.chains, []);
  } finally { cleanup(); }
});
