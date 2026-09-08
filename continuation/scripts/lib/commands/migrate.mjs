import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../frontmatter.mjs';
import { writeRecord, loadAll, memDir } from '../records.mjs';
import { firstCommitDate, repoRoot } from '../git.mjs';
import { slugify, stamp } from '../slug.mjs';
import { init } from './init.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';

const DATED = /^(\d{4}-\d{2}-\d{2})(T\d{6})?-(.+)\.md$/;

function h1(text) { const m = text.match(/^#\s+(.+)$/m); return m ? m[1].replace(/^(Continuation|Learnings?)\s*[:—-]\s*/i, '').trim() : ''; }
function stripH1(text) { return text.replace(/^#\s+.+\n+/, ''); }
function trim120(s) { return s.length > 120 ? `${s.slice(0, 117)}…` : s; }
function tagsFrom(...parts) {
  const STOP = /^(and|the|for|with|bug|gotchas?|notes?|session|not|new|live|onto|into|from|this|that|are|was|via|when|how|why|what|you|your|our|all|any|but|can|use|using|via|per|its|has|have|had|does|did|out|off|over|under|only|also|just|more|less|than|then|there|here|where|which|while|after|before|about|between|related|pattern|state|fix|fixes|fixed)$/;
  const words = parts.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w) && !STOP.test(w));
  const tags = [...new Set(words)].slice(0, 6);
  return tags.length ? tags : ['migrated'];
}

function importDated(root, type, file, name, existing) {
  const [, date, time, slug] = name.match(DATED);
  const id = `${date}${time ?? 'T000000'}-${slugify(slug)}`;
  if (existing.has(`${type}:${id}`)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const body = stripH1(text);
  const summary = trim120(h1(text) || slug.replace(/-/g, ' '));
  writeRecord(root, { id, type, status: 'active', tags: tagsFrom(slug), summary, branch: '—', files: [], supersedes: '—', superseded_by: '—', confidence: 'medium', auto: false }, body);
  return id;
}

function importSplit(root, file, name, existing) {
  const text = fs.readFileSync(file, 'utf8');
  const base = name.replace(/\.md$/, '');
  const when = firstCommitDate(root, path.relative(root, file)) ?? fs.statSync(file).mtime;
  const prefix = stamp(when);
  const parts = text.split(/^(?=## )/m).filter((p) => p.startsWith('## '));
  let count = 0;
  for (const part of parts) {
    const title = part.match(/^##\s+(.+)$/m)[1].replace(/^(bug|gotcha|lesson)\s*:\s*/i, '').trim();
    const id = `${prefix}-${slugify(`${base} ${title}`)}`;
    if (existing.has(`learning:${id}`)) continue;
    writeRecord(root, { id, type: 'learning', status: 'active', tags: tagsFrom(base, title), summary: trim120(title), branch: '—', files: [], supersedes: '—', superseded_by: '—', confidence: 'medium', auto: false }, part.replace(/^##\s+.+\n/, '## What happened\n'));
    count++;
  }
  return count;
}

export function migrateRepo(root) {
  const src = { sessions: path.join(root, '.claude/continuations'), learnings: path.join(root, '.claude/learnings') };
  const out = { sessions: 0, learnings: 0, splits: 0, skipped: 0, notes: [] };
  if (!fs.existsSync(src.sessions) && !fs.existsSync(src.learnings)) { out.notes.push('nothing to migrate'); return out; }
  if (!fs.existsSync(memDir(root))) init(root);
  const known = new Set(loadAll(root).records.map((r) => `${r.type}:${r.data.id}`));
  for (const [key, type] of [['sessions', 'session'], ['learnings', 'learning']]) {
    if (!fs.existsSync(src[key])) continue;
    for (const name of fs.readdirSync(src[key]).sort()) {
      const file = path.join(src[key], name);
      if (!name.endsWith('.md') || name.startsWith('.') || !fs.lstatSync(file).isFile()) { out.skipped++; continue; }
      if (DATED.test(name)) {
        const id = importDated(root, type, file, name, known);
        if (id) { known.add(`${type}:${id}`); out[key]++; }
      } else if (type === 'learning') {
        out.splits += importSplit(root, file, name, known);
      } else { out.skipped++; out.notes.push(`skipped undated session ${name}`); }
    }
  }
  rebuild(root);
  return out;
}

export async function run({ flags, positional, cwd, stdout }) {
  if (flags.all) {
    const { migrateAll } = await import('./migrate-all.mjs');
    const rows = migrateAll(path.resolve(cwd, String(flags.all)));
    stdout.write('| repo | sessions | learnings | splits | skipped |\n|---|---|---|---|---|\n');
    for (const r of rows) stdout.write(`| ${r.repo} | ${r.sessions} | ${r.learnings} | ${r.splits} | ${r.skipped} |\n`);
    stdout.write('\nSources untouched. Delete .claude/continuations/ and .claude/learnings/ per repo when satisfied.\n');
    return 0;
  }
  const root = resolveRoot(cwd, positional);
  const r = migrateRepo(root);
  stdout.write(`migrated ${root}: ${r.sessions} sessions, ${r.learnings} learnings, ${r.splits} split learnings, ${r.skipped} skipped\n${r.notes.map((n) => `  ${n}`).join('\n')}${r.notes.length ? '\n' : ''}`);
  if (r.sessions + r.learnings + r.splits) stdout.write('Sources untouched. Delete .claude/continuations/ and .claude/learnings/ when satisfied.\n');
  return 0;
}
