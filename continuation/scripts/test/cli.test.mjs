import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from '../continuation.mjs';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'continuation.mjs');

test('--help lists every command', () => {
  const out = execFileSync('node', [bin, '--help'], { encoding: 'utf8' });
  for (const c of ['init', 'rebuild', 'write', 'checkpoint', 'review', 'migrate']) {
    assert.match(out, new RegExp(`\\b${c}\\b`));
  }
});

test('unknown command exits 2', () => {
  let status = 0;
  try { execFileSync('node', [bin, 'nope'], { stdio: 'pipe' }); } catch (e) { status = e.status; }
  assert.equal(status, 2);
});

test('boolean flags do not swallow the following positional', () => {
  const r = parseArgs(['--if-stale', '--print-hot', '/tmp/x', '--type', 'decision']);
  assert.deepEqual(r, { flags: { 'if-stale': true, 'print-hot': true, type: 'decision' }, positional: ['/tmp/x'] });
});
