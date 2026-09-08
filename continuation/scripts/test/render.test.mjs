import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHot, renderIndex } from '../lib/render.mjs';

const mk = (type, n, extra = {}) => ({
  type, body: '', file: `${type}s/x.md`,
  data: { id: `2026-09-${String(n).padStart(2, '0')}T000000-${type}-${n}`, type, status: 'active', tags: [type, `t${n}`], summary: `${type} ${n}`, branch: 'main', files: [], supersedes: '—', superseded_by: '—', confidence: 'high', auto: false, ...extra },
});

test('HOT lists per type, newest first, active only, caps at 8, includes next task', () => {
  const records = [];
  for (let i = 1; i <= 12; i++) records.push(mk('decision', i));
  records.push(mk('convention', 1));
  records.push(mk('decision', 13, { status: 'retired' }));
  records.push({ ...mk('session', 20), body: '## What was done\n- a\n\n## Next task\nFix the webhook test\n\n## Key files\n- x\n' });
  records.sort((a, b) => (a.data.id < b.data.id ? 1 : -1));
  const hot = renderHot({ project: 'demo', records });
  const lines = hot.split('\n');
  assert.ok(lines.length <= 40, `got ${lines.length} lines`);
  assert.match(hot, /^# demo — continuation/m);
  assert.match(hot, /decision 12/);
  assert.doesNotMatch(hot, /decision 3\b/);
  assert.doesNotMatch(hot, /decision 13/);
  assert.match(hot, /Next task: Fix the webhook test/);
  assert.match(hot, /INDEX\.md/);
});

test('HOT with no records still renders', () => {
  const hot = renderHot({ project: 'empty', records: [] });
  assert.match(hot, /0 records/);
  assert.ok(hot.split('\n').length <= 40);
});

test('INDEX has active table, history table, invalid section', () => {
  const records = [mk('learning', 1), mk('learning', 2, { status: 'superseded', superseded_by: 'x' })];
  const idx = renderIndex({ records, invalid: [{ file: '.continuation/decisions/junk.md', reasons: ['no frontmatter'] }] });
  assert.match(idx, /\| id \| type \| branch \| auto \| tags \| summary \|/);
  assert.match(idx, /learning-1 \| learning \| main \| no \|/);
  assert.match(idx, /learning-1/);
  assert.match(idx, /## History[\s\S]*learning-2/);
  assert.match(idx, /## Invalid[\s\S]*junk\.md.*no frontmatter/);
});
