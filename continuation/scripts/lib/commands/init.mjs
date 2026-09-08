import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { memDir, TYPES, folderFor } from '../records.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';

const CONTRACT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'skills', 'continuation', 'references', 'agents-contract.md');
const IGNORE_LINES = ['.continuation/HOT.md', '.continuation/INDEX.md'];

export function ensureGitignore(root) {
  const gi = path.join(root, '.gitignore');
  const existing = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const have = new Set(existing.split('\n').map((l) => l.trim()));
  const missing = IGNORE_LINES.filter((l) => !have.has(l));
  if (!missing.length) return false;
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gi, `${existing}${sep}${existing ? '\n' : ''}# continuation derived files\n${missing.join('\n')}\n`);
  return true;
}

export function init(root) {
  const created = [];
  for (const t of TYPES) {
    const p = path.join(memDir(root), folderFor(t));
    if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); created.push(p); }
  }
  const agents = path.join(memDir(root), 'AGENTS.md');
  if (!fs.existsSync(agents)) { fs.copyFileSync(CONTRACT, agents); created.push(agents); }
  if (ensureGitignore(root)) created.push(path.join(root, '.gitignore'));
  rebuild(root);
  return { created };
}

export async function run({ positional, cwd, stdout }) {
  const root = resolveRoot(cwd, positional);
  const { created } = init(root);
  stdout.write(created.length ? `initialised .continuation/ in ${root}\n${created.map((c) => `  + ${path.relative(root, c)}`).join('\n')}\n` : `.continuation/ already initialised in ${root}\n`);
  return 0;
}
