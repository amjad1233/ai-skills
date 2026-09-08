#!/usr/bin/env node
const COMMANDS = ['init', 'rebuild', 'write', 'checkpoint', 'review', 'migrate'];
const BOOL_FLAGS = new Set(['if-stale', 'print-hot', 'json', 'auto']);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (BOOL_FLAGS.has(a.slice(2))) flags[a.slice(2)] = true;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}

function help() {
  return `continuation <command> [flags]

Commands:
  init        [dir]                    scaffold .continuation/ and AGENTS.md
  rebuild     [dir] [--if-stale] [--print-hot]
  write       --type T --tags a,b --summary S [--files p,q] [--supersedes id] [--confidence c] [--slug s] (body on stdin)
  checkpoint  [dir]                    hook-written session record from git state
  review      [dir] [--json]           hygiene report: stale, thin, orphan tags, chains, conflict candidates
  migrate     [dir] | --all <root>     import .claude/continuations and .claude/learnings
`;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h') { process.stdout.write(help()); return 0; }
  if (!COMMANDS.includes(cmd)) { process.stderr.write(`unknown command: ${cmd}\n${help()}`); return 2; }
  const mod = await import(`./lib/commands/${cmd}.mjs`);
  const { flags, positional } = parseArgs(rest);
  return (await mod.run({ flags, positional, cwd: process.cwd(), stdin: process.stdin, stdout: process.stdout })) ?? 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => { process.exitCode = code; }, (err) => { process.stderr.write(`${err.message}\n`); process.exitCode = 1; });
}
