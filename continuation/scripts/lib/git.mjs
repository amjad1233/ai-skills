import { execFileSync } from 'node:child_process';

function git(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

export function repoRoot(cwd) { return git(cwd, ['rev-parse', '--show-toplevel']); }
export function branch(cwd) { return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '—'; }

export function snapshot(cwd) {
  if (!repoRoot(cwd)) return { branch: '—', status: '', log: '', diffStat: '' };
  return {
    branch: branch(cwd),
    status: git(cwd, ['status', '--short']) ?? '',
    log: git(cwd, ['log', '--oneline', '-10']) ?? '',
    diffStat: git(cwd, ['diff', '--stat']) ?? '',
  };
}

export function firstCommitDate(cwd, file) {
  const out = git(cwd, ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file]);
  if (!out) return null;
  const last = out.split('\n').filter(Boolean).pop();
  return last ? new Date(last) : null;
}
