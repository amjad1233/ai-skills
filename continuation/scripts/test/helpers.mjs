import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function makeTempRepo({ git = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'continuation-'));
  if (git) {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'README.md'), '# t\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  }
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export function writeRecord(dir, type, id, front, body = '## Rule\nx\n') {
  const folder = path.join(dir, '.continuation', `${type}s`);
  fs.mkdirSync(folder, { recursive: true });
  const fm = { id, type, status: 'active', tags: ['t'], summary: 's', branch: 'main', files: [], supersedes: '—', superseded_by: '—', confidence: 'high', auto: false, ...front };
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`);
  lines.push('---', '', body);
  const file = path.join(folder, `${id}.md`);
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}
