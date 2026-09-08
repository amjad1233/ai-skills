import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize } from './frontmatter.mjs';
import { nextFreeName } from './slug.mjs';

export const TYPES = ['decision', 'learning', 'convention', 'session'];
export const STATUSES = ['active', 'superseded', 'retired'];
export const CONFIDENCES = ['high', 'medium', 'low'];
const ID_RE = /^\d{4}-\d{2}-\d{2}T\d{6}-[a-z][a-z0-9-]*$/;
const TAG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const memDir = (root) => path.join(root, '.continuation');
export const folderFor = (type) => `${type}s`;

export function validate(d) {
  const errs = [];
  for (const k of ['id', 'type', 'status', 'tags', 'summary']) if (d[k] === undefined || d[k] === '') errs.push(`${k}: required`);
  if (d.id !== undefined && !ID_RE.test(d.id)) errs.push('id: must be YYYY-MM-DDTHHMMSS-slug');
  if (d.type !== undefined && !TYPES.includes(d.type)) errs.push(`type: must be one of ${TYPES.join('|')}`);
  if (d.status !== undefined && !STATUSES.includes(d.status)) errs.push(`status: must be one of ${STATUSES.join('|')}`);
  if (d.confidence !== undefined && !CONFIDENCES.includes(d.confidence)) errs.push(`confidence: must be one of ${CONFIDENCES.join('|')}`);
  if (Array.isArray(d.tags)) {
    if (d.tags.length < 1 || d.tags.length > 6) errs.push('tags: 1–6 required');
    if (d.tags.some((t) => !TAG_RE.test(t))) errs.push('tags: lowercase kebab-case only');
  } else if (d.tags !== undefined) errs.push('tags: must be a list');
  if (typeof d.summary === 'string' && d.summary.length > 120) errs.push('summary: max 120 chars');
  for (const k of ['id', 'type', 'status', 'summary', 'branch', 'supersedes', 'superseded_by', 'confidence']) if (typeof d[k] === 'string' && /[\r\n]/.test(d[k])) errs.push(`${k}: no line breaks`);
  if (Array.isArray(d.tags) && d.tags.some((t) => /[\r\n]/.test(t))) errs.push('tags: no line breaks');
  if (Array.isArray(d.files) && d.files.some((f) => /[\r\n]/.test(f))) errs.push('files: no line breaks');
  return errs;
}

export function defaults(d) {
  return { branch: '—', files: [], supersedes: '—', superseded_by: '—', confidence: 'medium', auto: false, ...d };
}

export function loadAll(root) {
  const records = [];
  const invalid = [];
  for (const type of TYPES) {
    const folder = path.join(memDir(root), folderFor(type));
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder).filter((n) => n.endsWith('.md')).sort()) {
      const file = path.join(folder, name);
      const parsed = parse(fs.readFileSync(file, 'utf8'));
      if (!parsed) { invalid.push({ file, reasons: ['no frontmatter'] }); continue; }
      const errs = validate(parsed.data);
      if (parsed.data.id !== name.replace(/\.md$/, '')) errs.push(`id: must equal filename (${name})`);
      if (parsed.data.type !== type) errs.push(`type: must match folder ${folderFor(type)}`);
      if (errs.length) { invalid.push({ file, reasons: errs }); continue; }
      records.push({ data: parsed.data, body: parsed.body, file, type });
    }
  }
  records.sort((a, b) => (a.data.id < b.data.id ? 1 : a.data.id > b.data.id ? -1 : 0));
  return { records, invalid };
}

export function writeRecord(root, data, body) {
  const d = defaults(data);
  const errs = validate(d);
  if (errs.length) throw new Error(`invalid record: ${errs.join('; ')}`);
  const folder = path.join(memDir(root), folderFor(d.type));
  fs.mkdirSync(folder, { recursive: true });
  const text = body.endsWith('\n') ? body : `${body}\n`;
  for (let attempt = 0; attempt < 50; attempt++) {
    const name = nextFreeName(folder, d.id);
    const id = name.replace(/\.md$/, '');
    const file = path.join(folder, name);
    try {
      fs.writeFileSync(file, serialize({ ...d, id }, text), { flag: 'wx' });
      return file;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`could not allocate a free filename for ${d.id}`);
}

export function findById(root, id) {
  return loadAll(root).records.find((r) => r.data.id === id) ?? null;
}

export function supersede(root, oldId, newId) {
  const rec = findById(root, oldId);
  if (!rec) return false;
  rec.data.status = 'superseded';
  rec.data.superseded_by = newId;
  fs.writeFileSync(rec.file, serialize(rec.data, rec.body));
  return true;
}
