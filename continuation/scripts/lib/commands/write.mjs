import fs from 'node:fs';
import path from 'node:path';
import { writeRecord, supersede, memDir, findById } from '../records.mjs';
import { branch } from '../git.mjs';
import { slugify, stamp } from '../slug.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';
import { init } from './init.mjs';

export function write(root, { type, tags, summary, body, files = [], supersedes = '—', confidence = 'medium', slug, auto = false, when = new Date() }) {
  if (!fs.existsSync(memDir(root))) init(root);
  if (supersedes && supersedes !== '—' && !findById(root, supersedes)) throw new Error(`supersedes: no record with id ${supersedes}`);
  const id = `${stamp(when)}-${slugify(slug ?? summary)}`;
  const data = { id, type, status: 'active', tags, summary, branch: branch(root), files, supersedes, superseded_by: '—', confidence, auto };
  const file = writeRecord(root, data, body);
  const finalId = path.basename(file, '.md');
  if (supersedes && supersedes !== '—') supersede(root, supersedes, finalId);
  rebuild(root);
  return { file, id: finalId };
}

async function readStdin(stdin) {
  if (stdin.isTTY) return '';
  let s = '';
  for await (const chunk of stdin) s += chunk;
  return s;
}

const list = (v) => (typeof v === 'string' && v.length ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export async function run({ flags, positional, cwd, stdin, stdout }) {
  const root = resolveRoot(cwd, positional);
  const body = flags.body ?? (await readStdin(stdin));
  if (!body.trim()) throw new Error('body required on stdin or --body');
  const { file } = write(root, {
    type: flags.type, tags: list(flags.tags), summary: flags.summary, body,
    files: list(flags.files), supersedes: flags.supersedes ?? '—', confidence: flags.confidence ?? 'medium',
    slug: flags.slug, auto: flags.auto === true || flags.auto === 'true',
  });
  stdout.write(`Remembered: ${flags.summary} (${path.relative(root, file)})\n`);
  return 0;
}
