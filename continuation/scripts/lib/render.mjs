import { section } from './sections.mjs';
const CAP = 40;
const PER_TYPE = 8;

export function renderHot({ project, records }) {
  const active = records.filter((r) => r.data.status === 'active');
  const by = (t) => active.filter((r) => r.type === t);
  const counts = ['decision', 'learning', 'convention', 'session'].map((t) => `${by(t).length} ${t}s`).join(', ');
  const newest = records[0]?.data.id.slice(0, 10) ?? '—';
  const latestSession = by('session')[0];

  const build = (limit) => {
    const out = [`# ${project} — continuation`, `${records.length} records (${counts}). Newest: ${newest}.`, ''];
    for (const [t, label] of [['convention', 'Conventions'], ['decision', 'Decisions'], ['learning', 'Learnings']]) {
      const rows = by(t).slice(0, limit);
      if (!rows.length) continue;
      out.push(`## ${label}`);
      for (const r of rows) out.push(`- ${r.data.summary} [${r.data.tags.join(', ')}]`);
      out.push('');
    }
    if (latestSession) {
      const next = section(latestSession.body, 'Next task').split('\n')[0] || '—';
      out.push('## Last session', `- ${latestSession.data.summary} (${latestSession.data.id.slice(0, 10)}, ${latestSession.data.branch})`, `- Next task: ${next}`, '');
    }
    out.push('Full index: .continuation/INDEX.md. Records: .continuation/{type}/. Filter by tag with grep.');
    return out;
  };

  let limit = PER_TYPE;
  let lines = build(limit);
  while (lines.length > CAP && limit > 1) lines = build(--limit);
  return `${lines.slice(0, CAP).join('\n')}\n`;
}

const cell = (s) => String(s).replace(/\|/g, '\\|');

export function renderIndex({ records, invalid }) {
  const row = (r) => `| ${r.data.id} | ${r.type} | ${r.data.branch} | ${r.data.auto ? 'yes' : 'no'} | ${r.data.tags.join(', ')} | ${cell(r.data.summary)} |`;
  const active = records.filter((r) => r.data.status === 'active');
  const history = records.filter((r) => r.data.status !== 'active');
  const out = ['# Continuation index', '', '| id | type | branch | auto | tags | summary |', '|---|---|---|---|---|---|', ...active.map(row), ''];
  if (history.length) {
    out.push('## History', '', '| id | type | status | superseded_by | summary |', '|---|---|---|---|---|');
    for (const r of history) out.push(`| ${r.data.id} | ${r.type} | ${r.data.status} | ${r.data.superseded_by} | ${cell(r.data.summary)} |`);
    out.push('');
  }
  if (invalid.length) {
    out.push('## Invalid', '');
    for (const i of invalid) out.push(`- ${i.file}: ${i.reasons.join('; ')}`);
    out.push('');
  }
  return `${out.join('\n')}\n`;
}
