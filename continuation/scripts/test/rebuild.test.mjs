import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rebuild, run } from '../lib/commands/rebuild.mjs';
import { makeTempRepo, writeRecord } from './helpers.mjs';

test('rebuild writes HOT.md and INDEX.md', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    writeRecord(dir, 'decision', '2026-09-08T000000-a', { summary: 'use pint' });
    rebuild(dir);
    assert.match(fs.readFileSync(path.join(dir, '.continuation/HOT.md'), 'utf8'), /use pint/);
    assert.match(fs.readFileSync(path.join(dir, '.continuation/INDEX.md'), 'utf8'), /2026-09-08T000000-a/);
  } finally { cleanup(); }
});

test('--if-stale skips when HOT is fresh', async () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    writeRecord(dir, 'decision', '2026-09-08T000000-a', {});
    rebuild(dir);
    const hot = path.join(dir, '.continuation/HOT.md');
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(hot, future, future);
    fs.writeFileSync(hot, 'sentinel');
    fs.utimesSync(hot, future, future);
    await run({ flags: { 'if-stale': true }, positional: [dir], cwd: dir, stdout: { write() {} } });
    assert.equal(fs.readFileSync(hot, 'utf8'), 'sentinel');
  } finally { cleanup(); }
});

test('--print-hot prints and missing folder exits 0', async () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    let out = '';
    const code = await run({ flags: { 'print-hot': true }, positional: [dir], cwd: dir, stdout: { write: (s) => { out += s; } } });
    assert.equal(code, 0);
    assert.equal(out, '');
    writeRecord(dir, 'convention', '2026-09-08T000000-c', { summary: 'conventional commits' });
    await run({ flags: { 'print-hot': true }, positional: [dir], cwd: dir, stdout: { write: (s) => { out += s; } } });
    assert.match(out, /conventional commits/);
  } finally { cleanup(); }
});

test('--if-stale rebuilds when INDEX.md is missing', async () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    writeRecord(dir, 'decision', '2026-09-08T000000-a', {});
    rebuild(dir);
    const idx = path.join(dir, '.continuation/INDEX.md');
    fs.unlinkSync(idx);
    await run({ flags: { 'if-stale': true }, positional: [dir], cwd: dir, stdout: { write() {} } });
    assert.ok(fs.existsSync(idx));
  } finally { cleanup(); }
});

test('rebuild refuses to write through a symlinked derived file', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    writeRecord(dir, 'decision', '2026-09-08T000000-a', {});
    const target = path.join(dir, 'victim.txt');
    fs.writeFileSync(target, 'keep');
    fs.symlinkSync(target, path.join(dir, '.continuation/HOT.md'));
    assert.throws(() => rebuild(dir), /symlink/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
  } finally { cleanup(); }
});
