import fs from 'node:fs';
import path from 'node:path';
import { loadAll } from '../records.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';

const DAY = 86_400_000;
function idToDate(id) {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : new Date(0);
}

export function report(root, { now = new Date() } = {}) {
  const { records } = loadAll(root);
  const active = records.filter((r) => r.data.status === 'active');

  const conflictCandidates = [];
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i], b = active[j];
    if (a.type !== b.type || a.type === 'session') continue;
    if (a.data.id.slice(0, 17) === b.data.id.slice(0, 17)) continue;
    const [a0, a1] = a.data.tags, [b0, b1] = b.data.tags;
    if (a0 === b0 && (a1 ?? a0) === (b1 ?? b0)) conflictCandidates.push([a.data.id, b.data.id]);
  }

  const stale = [];
  for (const r of active) {
    const inside = (f) => { const p = path.resolve(root, f); return p === root || p.startsWith(root + path.sep); };
    const missing = (r.data.files ?? []).filter((f) => !inside(f) || !fs.existsSync(path.resolve(root, f)));
    if (missing.length) stale.push({ id: r.data.id, reason: `files missing: ${missing.join(', ')}` });
  }

  const thin = [];
  for (const r of active) {
    const bodyLines = r.body.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
    if (r.data.confidence === 'low' && !r.data.auto) thin.push({ id: r.data.id, reason: 'confidence low' });
    if (bodyLines < 3) thin.push({ id: r.data.id, reason: `body short (${bodyLines} lines)` });
    if (r.data.auto && now - idToDate(r.data.id) > 7 * DAY) thin.push({ id: r.data.id, reason: 'auto checkpoint older than 7 days' });
  }

  const tagCount = new Map();
  for (const r of active) for (const t of r.data.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const orphanTags = [];
  for (const r of active) for (const t of r.data.tags) if (tagCount.get(t) === 1) orphanTags.push({ tag: t, id: r.data.id });

  const byId = new Map(records.map((r) => [r.data.id, r]));
  const chains = [];
  for (const r of active) {
    const ids = [r.data.id];
    let cur = r;
    const seen = new Set(ids);
    while (cur && cur.data.supersedes && cur.data.supersedes !== '—' && byId.has(cur.data.supersedes) && !seen.has(cur.data.supersedes)) { cur = byId.get(cur.data.supersedes); ids.push(cur.data.id); seen.add(cur.data.id); }
    if (ids.length > 3) chains.push({ tag: r.data.tags[0], length: ids.length, ids });
  }

  return { conflictCandidates, stale, thin, orphanTags, chains };
}

export function toMarkdown(r) {
  const out = ['# Continuation review', ''];
  const sec = (title, rows) => { out.push(`## ${title} (${rows.length})`, ''); for (const row of rows) out.push(`- ${row}`); out.push(''); };
  sec('Conflict candidates — read both, decide if they contradict', r.conflictCandidates.map(([a, b]) => `${a} ↔ ${b}`));
  sec('Stale', r.stale.map((s) => `${s.id}: ${s.reason}`));
  sec('Thin', r.thin.map((t) => `${t.id}: ${t.reason}`));
  sec('Orphan tags', r.orphanTags.map((o) => `${o.tag} (only on ${o.id})`));
  sec('Long supersession chains', r.chains.map((c) => `${c.tag}: ${c.length} records — ${c.ids.join(' ← ')}`));
  return `${out.join('\n')}\n`;
}

export async function run({ flags, positional, cwd, stdout }) {
  const root = resolveRoot(cwd, positional);
  rebuild(root);
  const r = report(root);
  stdout.write(flags.json ? `${JSON.stringify(r, null, 2)}\n` : toMarkdown(r));
  return 0;
}
