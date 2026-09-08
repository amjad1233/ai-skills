import { section } from '../sections.mjs';
import fs from 'node:fs';
import { loadAll, memDir } from '../records.mjs';
import { snapshot } from '../git.mjs';
import { slugify } from '../slug.mjs';
import { write } from './write.mjs';
import { resolveRoot } from './rebuild.mjs';

const TEN_MIN = 10 * 60 * 1000;

function idToDate(id) {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : new Date(0);
}

export function checkpoint(root, { now = new Date() } = {}) {
  if (!fs.existsSync(memDir(root))) return { skipped: 'not initialised' };
  const snap = snapshot(root);
  const sessions = loadAll(root).records.filter((r) => r.type === 'session' && r.data.branch === snap.branch);
  const latest = sessions[0];
  if (latest && now - idToDate(latest.data.id) < TEN_MIN) return { skipped: 'recent session on branch' };
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const next = latest ? section(latest.body, 'Next task') : '';
  const keyFiles = latest ? section(latest.body, 'Key files') : '';
  const fence = (s) => (s ? `\`\`\`\n${s}\n\`\`\`` : '—');
  const body = [
    '## What was done', '- Auto checkpoint written by a hook. No narrative captured.', '',
    '## Current state', `- **Branch:** ${snap.branch}`, `- **Uncommitted changes:**`, fence(snap.status), '- **Recent commits:**', fence(snap.log), '- **Diff stat:**', fence(snap.diffStat), '',
    '## Next task', next || '— (no prior session on this branch)', '',
    '## Key files', keyFiles || '—', '',
  ].join('\n');
  const { file } = write(root, {
    type: 'session', tags: ['checkpoint', slugify(snap.branch, { max: 3 })].filter((t, i, a) => a.indexOf(t) === i),
    summary: `Auto checkpoint at ${hhmm}`, body, confidence: 'low', auto: true, slug: 'auto-checkpoint', when: now,
  });
  return { file };
}

export async function run({ positional, cwd, stdout }) {
  const r = checkpoint(resolveRoot(cwd, positional));
  stdout.write(r.file ? `checkpoint: ${r.file}\n` : `checkpoint skipped: ${r.skipped}\n`);
  return 0;
}
