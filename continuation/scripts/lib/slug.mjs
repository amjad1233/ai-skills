import fs from 'node:fs';
import path from 'node:path';

export function slugify(text, { max = 5 } = {}) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  while (words.length && !/^[a-z]/.test(words[0])) words.shift();
  const out = words.slice(0, max).join('-');
  return out || 'record';
}

const p2 = (n) => String(n).padStart(2, '0');
export function stamp(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}
export function isoStamp(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function nextFreeName(dir, base) {
  let name = `${base}.md`;
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${base}-${n}.md`;
  return name;
}
