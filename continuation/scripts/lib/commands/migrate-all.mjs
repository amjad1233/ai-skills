import fs from 'node:fs';
import path from 'node:path';
import { migrateRepo } from './migrate.mjs';

const SKIP = new Set(['node_modules', 'vendor', '.git', '.claude', '.continuation']);

function findRepos(dir, depth, out) {
  if (depth < 0) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const hasGit = entries.some((e) => e.name === '.git');
  const hasOld = fs.existsSync(path.join(dir, '.claude/continuations')) || fs.existsSync(path.join(dir, '.claude/learnings'));
  if (hasGit && hasOld) out.push(dir);
  for (const e of entries) if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')) findRepos(path.join(dir, e.name), depth - 1, out);
}

export function migrateAll(rootDir) {
  const repos = [];
  findRepos(rootDir, 3, repos);
  return repos.sort().map((repo) => {
    const r = migrateRepo(repo);
    return { repo: path.relative(rootDir, repo) || '.', sessions: r.sessions, learnings: r.learnings, splits: r.splits, skipped: r.skipped };
  });
}
