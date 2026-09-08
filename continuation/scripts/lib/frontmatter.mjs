const ARRAY_KEYS = new Set(['tags', 'files']);
const BOOL_KEYS = new Set(['auto']);
export const FIELD_ORDER = ['id', 'type', 'status', 'tags', 'summary', 'branch', 'files', 'supersedes', 'superseded_by', 'confidence', 'auto'];

export function parse(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const body = text.slice(end + 5).replace(/^\n/, '');
  const data = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([a-z_]+):\s?(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (ARRAY_KEYS.has(k)) {
      const inner = raw.trim().replace(/^\[|\]$/g, '').trim();
      data[k] = inner ? inner.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else if (BOOL_KEYS.has(k)) data[k] = raw.trim() === 'true';
    else data[k] = raw.trim();
  }
  return { data, body };
}

export function serialize(data, body) {
  const keys = [...FIELD_ORDER.filter((k) => k in data), ...Object.keys(data).filter((k) => !FIELD_ORDER.includes(k))];
  const lines = ['---'];
  for (const k of keys) {
    const v = data[k];
    lines.push(`${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : String(v)}`);
  }
  lines.push('---', '');
  return `${lines.join('\n')}\n${body}`;
}
