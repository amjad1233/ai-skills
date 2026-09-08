import fs from 'node:fs';
import path from 'node:path';
import { loadAll, memDir, TYPES, folderFor } from '../records.mjs';
import { renderHot, renderIndex } from '../render.mjs';
import { repoRoot } from '../git.mjs';

export function resolveRoot(cwd, positional) {
  const start = positional[0] ? path.resolve(cwd, positional[0]) : cwd;
  return repoRoot(start) ?? start;
}

export function isStale(root) {
  const hot = path.join(memDir(root), 'HOT.md');
  if (!fs.existsSync(hot) || !fs.existsSync(path.join(memDir(root), 'INDEX.md'))) return true;
  const hotTime = fs.statSync(hot).mtimeMs;
  for (const t of TYPES) {
    const folder = path.join(memDir(root), folderFor(t));
    if (!fs.existsSync(folder)) continue;
    for (const n of fs.readdirSync(folder)) if (fs.statSync(path.join(folder, n)).mtimeMs > hotTime) return true;
  }
  return false;
}

export function rebuild(root) {
  const { records, invalid } = loadAll(root);
  const project = path.basename(root);
  const hot = renderHot({ project, records });
  const index = renderIndex({ records, invalid });
  fs.mkdirSync(memDir(root), { recursive: true });
  for (const p of [memDir(root), path.join(memDir(root), 'HOT.md'), path.join(memDir(root), 'INDEX.md')]) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${p}`);
  }
  fs.writeFileSync(path.join(memDir(root), 'HOT.md'), hot);
  fs.writeFileSync(path.join(memDir(root), 'INDEX.md'), index);
  return { hot, index, records, invalid };
}

export async function run({ flags, positional, cwd, stdout }) {
  const root = resolveRoot(cwd, positional);
  if (!fs.existsSync(memDir(root))) { process.stderr.write(`no .continuation/ in ${root}\n`); return 0; }
  let hot;
  if (flags['if-stale'] && !isStale(root)) hot = fs.readFileSync(path.join(memDir(root), 'HOT.md'), 'utf8');
  else ({ hot } = rebuild(root));
  if (flags['print-hot']) stdout.write(hot);
  return 0;
}
