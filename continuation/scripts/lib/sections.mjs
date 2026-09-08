const LOOSE = {
  'Next task': /next[^\n]*task|next step|next\b/i,
  'Key files': /key file/i,
};

export function section(body, heading) {
  const exact = body.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  if (exact) return exact[1].trim();
  const loose = LOOSE[heading];
  if (!loose) return '';
  const lines = body.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && loose.test(l.slice(3)));
  if (start === -1) return '';
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) out.push(lines[i]);
  return out.join('\n').trim();
}
