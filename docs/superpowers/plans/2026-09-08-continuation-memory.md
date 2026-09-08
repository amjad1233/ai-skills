# Continuation: Project Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `claude-continuation` plugin with `continuation`: a `.continuation/` project-memory folder of typed markdown records, derived `HOT.md`/`INDEX.md`, autonomous writes, hook-driven checkpoints, a review pass, and a migrator for the ~60 existing repos.

**Architecture:** One markdown file per record with YAML frontmatter under `.continuation/{decisions,learnings,conventions,sessions}/`. A zero-dependency Node helper `continuation/scripts/continuation.mjs` does the mechanical work (parse, validate, rebuild indexes, write, checkpoint, review report, init, migrate). Slash-command files and the skill do the judgement work and call the helper. Claude Code hooks call the helper on session start, pre-compact and session end.

**Tech Stack:** Node ≥ 18 ESM, zero runtime deps, `node:test` + `node:assert/strict`, run with `node --test continuation/scripts/test/`. Markdown command/skill files. Plugin manifest + `hooks/hooks.json`.

**Spec:** `docs/superpowers/specs/2026-09-08-continuation-memory-design.md`

## Global Constraints

- Folder name is `.continuation/` at the repo root. Derived files `HOT.md` and `INDEX.md` are gitignored, everything else committed.
- Filename and `id`: `{YYYY-MM-DDTHHMMSS}-{slug}` local time. Slug: starts with a letter, lowercase letters, digits, hyphens, 2–5 words. Same-second collision appends `-2`, `-3`. Never overwrite.
- Frontmatter fields: `id, type, status, tags, summary, branch, files, supersedes, superseded_by, confidence, auto`. Required: `id, type, status, tags, summary`. `type ∈ {decision, learning, convention, session}`, `status ∈ {active, superseded, retired}`, `confidence ∈ {high, medium, low}`, `tags` 1–6 lowercase kebab-case, `summary` ≤ 120 chars.
- `HOT.md` hard cap 40 lines. Per-type lists max 8, active only, newest first.
- No author or dev-name field anywhere. Branch is the only provenance.
- Helper never deletes a record. Review retires; migrate leaves sources untouched.
- Checkpoint skips if a session record on the same branch is under 10 minutes old.
- Don't run the test suite unless the plan step says to run a single targeted test; the user runs the full suite. Each task names the exact command.
- Conventional commits `type(continuation): description`. No attribution lines.
- Work on branch `feat/project-memory` (already exists with the spec).

---

## File structure

```
continuation/                                  # renamed from claude-continuation/
├── .claude-plugin/plugin.json                 # name continuation, version 2.0.0
├── hooks/hooks.json                           # SessionStart / PreCompact / SessionEnd → helper
├── commands/
│   ├── end.md                                 # /end
│   ├── continue.md                            # /continue
│   ├── remember.md                            # /remember
│   ├── continuation-review.md                 # /continuation-review
│   └── next.md                                # /next (unchanged)
├── skills/continuation/
│   ├── SKILL.md                               # portable skill: triggers, write rules, read path
│   └── references/
│       ├── record-schema.md                   # frontmatter + body sections per type
│       └── agents-contract.md                 # template copied to .continuation/AGENTS.md by init
├── scripts/
│   ├── continuation.mjs                       # CLI entry + dispatch
│   ├── lib/
│   │   ├── frontmatter.mjs                    # parse / serialize the YAML subset
│   │   ├── slug.mjs                           # slugify, timestamp, nextFreeName
│   │   ├── records.mjs                        # load, validate, paths, supersede
│   │   ├── git.mjs                            # branch, status, log, diff-stat, repoRoot
│   │   ├── render.mjs                         # HOT.md and INDEX.md builders
│   │   ├── commands/
│   │   │   ├── init.mjs
│   │   │   ├── rebuild.mjs
│   │   │   ├── write.mjs
│   │   │   ├── checkpoint.mjs
│   │   │   ├── review.mjs
│   │   │   └── migrate.mjs
│   └── test/
│       ├── helpers.mjs                        # makeTempRepo(), writeRecord()
│       ├── frontmatter.test.mjs
│       ├── slug.test.mjs
│       ├── records.test.mjs
│       ├── render.test.mjs
│       ├── init.test.mjs
│       ├── write.test.mjs
│       ├── checkpoint.test.mjs
│       ├── review.test.mjs
│       └── migrate.test.mjs
├── package.json                               # private, "type":"module", test script only
├── README.md
├── CHANGELOG.md
├── MIGRATION.md
└── LICENSE
```

Modified elsewhere: `.claude-plugin/marketplace.json`, root `README.md`, `docs/index.html`, `docs/claude-continuation/` → `docs/continuation/`, `.gitignore`, `openspec/changes/add-continuation-standard/` (archived).

---

### Task 1: Rename the plugin directory and scaffold the helper

**Files:**
- Rename: `claude-continuation/` → `continuation/` (git mv)
- Create: `continuation/package.json`, `continuation/scripts/continuation.mjs`, `continuation/scripts/test/helpers.mjs`
- Modify: `continuation/.claude-plugin/plugin.json`

**Interfaces:**
- Produces: `continuation.mjs <command> [flags]` dispatch; `makeTempRepo()` returning `{ dir, cleanup }` for all later tests.

- [ ] **Step 1: Rename and update the manifest**

```bash
git mv claude-continuation continuation
```

Replace `continuation/.claude-plugin/plugin.json` with:

```json
{
  "name": "continuation",
  "description": "Project memory for any coding agent. Typed decisions, learnings, conventions and session handoffs in .continuation/, written autonomously, read in one hot file every session. /end, /continue, /remember, /continuation-review, /next.",
  "version": "2.0.0",
  "author": { "name": "Amjad Pathan" },
  "homepage": "https://claude-skills.amjad1233.com",
  "repository": "https://github.com/amjad1233/ai-skills",
  "license": "MIT",
  "keywords": ["memory", "session", "handoff", "continuation", "learnings", "decisions", "resume", "agents"]
}
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "continuation-helper",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": { "test": "node --test scripts/test/" }
}
```

- [ ] **Step 3: Write the failing dispatch test**

`continuation/scripts/test/cli.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'continuation.mjs');

test('--help lists every command', () => {
  const out = execFileSync('node', [bin, '--help'], { encoding: 'utf8' });
  for (const c of ['init', 'rebuild', 'write', 'checkpoint', 'review', 'migrate']) {
    assert.match(out, new RegExp(`\\b${c}\\b`));
  }
});

test('unknown command exits 2', () => {
  let status = 0;
  try { execFileSync('node', [bin, 'nope'], { stdio: 'pipe' }); } catch (e) { status = e.status; }
  assert.equal(status, 2);
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `node --test continuation/scripts/test/cli.test.mjs`
Expected: FAIL, cannot find module `continuation.mjs`.

- [ ] **Step 5: Write the entry point**

`continuation/scripts/continuation.mjs`:

```js
#!/usr/bin/env node
const COMMANDS = ['init', 'rebuild', 'write', 'checkpoint', 'review', 'migrate'];

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
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
  main().then((code) => process.exit(code), (err) => { process.stderr.write(`${err.message}\n`); process.exit(1); });
}
```

Create stub files so the import in later tasks resolves: for each of `init, rebuild, write, checkpoint, review, migrate` create `continuation/scripts/lib/commands/<name>.mjs` containing:

```js
export async function run() { throw new Error('not implemented'); }
```

- [ ] **Step 6: Write the test helper**

`continuation/scripts/test/helpers.mjs`:

```js
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
```

- [ ] **Step 7: Run the dispatch test**

Run: `node --test continuation/scripts/test/cli.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add -A continuation
git commit -m "feat(continuation): rename plugin, scaffold helper CLI and test harness"
```

---

### Task 2: Frontmatter parse and serialize

**Files:**
- Create: `continuation/scripts/lib/frontmatter.mjs`, `continuation/scripts/test/frontmatter.test.mjs`

**Interfaces:**
- Produces: `parse(text) → { data: object, body: string } | null` (null when no frontmatter block); `serialize(data, body) → string`. Arrays are `[a, b]`; scalars are strings except `auto` which is boolean; `—` is the empty sentinel and round-trips as the string `'—'`.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../lib/frontmatter.mjs';

const doc = `---
id: 2026-09-08T083012-stripe-webhook-verification
type: decision
status: active
tags: [stripe, webhooks, security]
summary: Verify Stripe signatures with the SDK, never hand-roll HMAC
branch: feat/stripe
files: [app/Http/Controllers/StripeWebhookController.php]
supersedes: —
superseded_by: —
confidence: high
auto: false
---

## Context
x
`;

test('parse returns data and body', () => {
  const r = parse(doc);
  assert.equal(r.data.id, '2026-09-08T083012-stripe-webhook-verification');
  assert.deepEqual(r.data.tags, ['stripe', 'webhooks', 'security']);
  assert.deepEqual(r.data.files, ['app/Http/Controllers/StripeWebhookController.php']);
  assert.equal(r.data.auto, false);
  assert.equal(r.data.supersedes, '—');
  assert.equal(r.body, '## Context\nx\n');
});

test('parse returns null without a block', () => {
  assert.equal(parse('# Just markdown\n'), null);
});

test('parse handles empty arrays and colons in values', () => {
  const r = parse('---\ntags: []\nsummary: a: b\n---\nbody');
  assert.deepEqual(r.data.tags, []);
  assert.equal(r.data.summary, 'a: b');
});

test('serialize round-trips', () => {
  const r = parse(doc);
  assert.equal(serialize(r.data, r.body), doc);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/frontmatter.test.mjs`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```js
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
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/frontmatter.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/frontmatter.mjs continuation/scripts/test/frontmatter.test.mjs
git commit -m "feat(continuation): frontmatter parse and serialize"
```

---

### Task 3: Slug, timestamp and collision-free filenames

**Files:**
- Create: `continuation/scripts/lib/slug.mjs`, `continuation/scripts/test/slug.test.mjs`

**Interfaces:**
- Produces: `slugify(text, {max=5}) → string`; `stamp(date=new Date()) → 'YYYY-MM-DDTHHMMSS'` local time; `isoStamp(date) → 'YYYY-MM-DDTHH:MM:SS'`; `nextFreeName(dir, base) → string` (returns `base.md`, else `base-2.md`, `-3`…).

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { slugify, stamp, isoStamp, nextFreeName } from '../lib/slug.mjs';
import { makeTempRepo } from './helpers.mjs';

test('slugify lowercases, strips punctuation, caps words, starts with a letter', () => {
  assert.equal(slugify('Stripe Webhook: Verification!'), 'stripe-webhook-verification');
  assert.equal(slugify('one two three four five six seven'), 'one-two-three-four-five');
  assert.equal(slugify('2 factor auth'), 'factor-auth');
  assert.equal(slugify('!!!'), 'record');
});

test('stamp formats local time without separators', () => {
  const d = new Date(2026, 8, 8, 8, 30, 12);
  assert.equal(stamp(d), '2026-09-08T083012');
  assert.equal(isoStamp(d), '2026-09-08T08:30:12');
});

test('nextFreeName appends -2, -3', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    assert.equal(nextFreeName(dir, 'a'), 'a.md');
    fs.writeFileSync(path.join(dir, 'a.md'), '');
    assert.equal(nextFreeName(dir, 'a'), 'a-2.md');
    fs.writeFileSync(path.join(dir, 'a-2.md'), '');
    assert.equal(nextFreeName(dir, 'a'), 'a-3.md');
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/slug.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
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
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/slug.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/slug.mjs continuation/scripts/test/slug.test.mjs
git commit -m "feat(continuation): slug, timestamp and collision-safe filenames"
```

---

### Task 4: Git helpers

**Files:**
- Create: `continuation/scripts/lib/git.mjs`, `continuation/scripts/test/git.test.mjs`

**Interfaces:**
- Produces: `repoRoot(cwd) → string|null`; `branch(cwd) → string` (`'—'` outside git); `snapshot(cwd) → { branch, status, log, diffStat }` all strings; `firstCommitDate(cwd, file) → Date|null`.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { repoRoot, branch, snapshot, firstCommitDate } from '../lib/git.mjs';
import { makeTempRepo } from './helpers.mjs';

test('repoRoot and branch inside a repo', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    assert.equal(fs.realpathSync(repoRoot(dir)), fs.realpathSync(dir));
    assert.equal(branch(dir), 'main');
  } finally { cleanup(); }
});

test('outside a repo: root null, branch em dash, snapshot empty', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    assert.equal(repoRoot(dir), null);
    assert.equal(branch(dir), '—');
    assert.deepEqual(snapshot(dir), { branch: '—', status: '', log: '', diffStat: '' });
  } finally { cleanup(); }
});

test('snapshot and firstCommitDate', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
    const s = snapshot(dir);
    assert.match(s.status, /\?\? a\.txt/);
    assert.match(s.log, /init/);
    assert.ok(firstCommitDate(dir, 'README.md') instanceof Date);
    assert.equal(firstCommitDate(dir, 'a.txt'), null);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/git.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
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
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/git.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/git.mjs continuation/scripts/test/git.test.mjs
git commit -m "feat(continuation): git snapshot helpers"
```

---

### Task 5: Records: load, validate, paths, supersede

**Files:**
- Create: `continuation/scripts/lib/records.mjs`, `continuation/scripts/test/records.test.mjs`

**Interfaces:**
- Consumes: `parse/serialize` (Task 2), `nextFreeName` (Task 3).
- Produces:
  - `TYPES = ['decision','learning','convention','session']`, `folderFor(type) → 'decisions'|…`, `memDir(root) → root/.continuation`.
  - `validate(data) → string[]` (empty = valid).
  - `loadAll(root) → { records: Record[], invalid: {file, reasons}[] }` where `Record = { data, body, file, type }`, sorted by id descending.
  - `writeRecord(root, data, body) → file` (creates folder, uses nextFreeName on the id, rewrites `data.id` to match the final filename).
  - `supersede(root, oldId, newId) → boolean` (sets old `status: superseded`, `superseded_by: newId`; false if old not found).

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validate, loadAll, writeRecord, supersede, folderFor } from '../lib/records.mjs';
import { parse } from '../lib/frontmatter.mjs';
import { makeTempRepo, writeRecord as fixture } from './helpers.mjs';

const good = { id: '2026-09-08T083012-a-b', type: 'decision', status: 'active', tags: ['a'], summary: 's' };

test('validate: required fields, enums, tag shape, summary length', () => {
  assert.deepEqual(validate(good), []);
  assert.ok(validate({ ...good, type: 'note' }).some((e) => /type/.test(e)));
  assert.ok(validate({ ...good, tags: [] }).some((e) => /tags/.test(e)));
  assert.ok(validate({ ...good, tags: ['Bad Tag'] }).some((e) => /tags/.test(e)));
  assert.ok(validate({ ...good, tags: ['a','b','c','d','e','f','g'] }).some((e) => /tags/.test(e)));
  assert.ok(validate({ ...good, summary: 'x'.repeat(121) }).some((e) => /summary/.test(e)));
  assert.ok(validate({ ...good, id: 'bad id' }).some((e) => /id/.test(e)));
  assert.ok(validate({ ...good, confidence: 'sure' }).some((e) => /confidence/.test(e)));
});

test('folderFor pluralises', () => {
  assert.equal(folderFor('decision'), 'decisions');
  assert.equal(folderFor('session'), 'sessions');
});

test('loadAll sorts newest first and reports invalid files', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    fixture(dir, 'decision', '2026-09-01T000000-old', {});
    fixture(dir, 'learning', '2026-09-02T000000-new', {});
    fs.writeFileSync(path.join(dir, '.continuation', 'decisions', 'junk.md'), '# no frontmatter\n');
    const { records, invalid } = loadAll(dir);
    assert.deepEqual(records.map((r) => r.data.id), ['2026-09-02T000000-new', '2026-09-01T000000-old']);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].file, /junk\.md$/);
  } finally { cleanup(); }
});

test('writeRecord creates folder, avoids collisions, syncs id', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    const f1 = writeRecord(dir, { ...good }, '## Decision\nx\n');
    const f2 = writeRecord(dir, { ...good }, '## Decision\ny\n');
    assert.match(f1, /decisions\/2026-09-08T083012-a-b\.md$/);
    assert.match(f2, /decisions\/2026-09-08T083012-a-b-2\.md$/);
    assert.equal(parse(fs.readFileSync(f2, 'utf8')).data.id, '2026-09-08T083012-a-b-2');
  } finally { cleanup(); }
});

test('supersede flips the old record', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    const old = fixture(dir, 'decision', '2026-09-01T000000-old', {});
    assert.equal(supersede(dir, '2026-09-01T000000-old', '2026-09-02T000000-new'), true);
    const d = parse(fs.readFileSync(old, 'utf8')).data;
    assert.equal(d.status, 'superseded');
    assert.equal(d.superseded_by, '2026-09-02T000000-new');
    assert.equal(supersede(dir, 'missing', 'x'), false);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/records.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
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
  const name = nextFreeName(folder, d.id);
  d.id = name.replace(/\.md$/, '');
  const file = path.join(folder, name);
  fs.writeFileSync(file, serialize(d, body.endsWith('\n') ? body : `${body}\n`));
  return file;
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
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/records.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/records.mjs continuation/scripts/test/records.test.mjs
git commit -m "feat(continuation): record load, validate, write and supersede"
```

---

### Task 6: Render HOT.md and INDEX.md

**Files:**
- Create: `continuation/scripts/lib/render.mjs`, `continuation/scripts/test/render.test.mjs`

**Interfaces:**
- Consumes: `loadAll` output shape.
- Produces: `renderHot({ project, records }) → string` (≤ 40 lines guaranteed); `renderIndex({ records, invalid }) → string`.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHot, renderIndex } from '../lib/render.mjs';

const mk = (type, n, extra = {}) => ({
  type, body: '', file: `${type}s/x.md`,
  data: { id: `2026-09-${String(n).padStart(2, '0')}T000000-${type}-${n}`, type, status: 'active', tags: [type, `t${n}`], summary: `${type} ${n}`, branch: 'main', files: [], supersedes: '—', superseded_by: '—', confidence: 'high', auto: false, ...extra },
});

test('HOT lists per type, newest first, active only, caps at 8, includes next task', () => {
  const records = [];
  for (let i = 1; i <= 12; i++) records.push(mk('decision', i));
  records.push(mk('convention', 1));
  records.push(mk('decision', 13, { status: 'retired' }));
  records.push({ ...mk('session', 20), body: '## What was done\n- a\n\n## Next task\nFix the webhook test\n\n## Key files\n- x\n' });
  records.sort((a, b) => (a.data.id < b.data.id ? 1 : -1));
  const hot = renderHot({ project: 'demo', records });
  const lines = hot.split('\n');
  assert.ok(lines.length <= 40, `got ${lines.length} lines`);
  assert.match(hot, /^# demo — continuation/m);
  assert.match(hot, /decision 12/);
  assert.doesNotMatch(hot, /decision 3\b/);
  assert.doesNotMatch(hot, /decision 13/);
  assert.match(hot, /Next task: Fix the webhook test/);
  assert.match(hot, /INDEX\.md/);
});

test('HOT with no records still renders', () => {
  const hot = renderHot({ project: 'empty', records: [] });
  assert.match(hot, /0 records/);
  assert.ok(hot.split('\n').length <= 40);
});

test('INDEX has active table, history table, invalid section', () => {
  const records = [mk('learning', 1), mk('learning', 2, { status: 'superseded', superseded_by: 'x' })];
  const idx = renderIndex({ records, invalid: [{ file: '.continuation/decisions/junk.md', reasons: ['no frontmatter'] }] });
  assert.match(idx, /\| id \| type \| tags \| summary \|/);
  assert.match(idx, /learning-1/);
  assert.match(idx, /## History[\s\S]*learning-2/);
  assert.match(idx, /## Invalid[\s\S]*junk\.md.*no frontmatter/);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/render.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
const CAP = 40;
const PER_TYPE = 8;

function section(body, heading) {
  const m = body.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

export function renderHot({ project, records }) {
  const active = records.filter((r) => r.data.status === 'active');
  const by = (t) => active.filter((r) => r.type === t);
  const counts = ['decision', 'learning', 'convention', 'session'].map((t) => `${by(t).length} ${t}s`).join(', ');
  const newest = records[0]?.data.id.slice(0, 10) ?? '—';
  const latestSession = by('session')[0];

  const build = (limit) => {
    const out = [`# ${project} — continuation`, `${records.length} records (${counts}). Newest: ${newest}.`, ''];
    for (const [t, label] of [['convention', 'Conventions'], ['decision', 'Decisions'], ['learning', 'Learnings']]) {
      const rows = by(t).slice(0, limit);
      if (!rows.length) continue;
      out.push(`## ${label}`);
      for (const r of rows) out.push(`- ${r.data.summary} [${r.data.tags.join(', ')}]`);
      out.push('');
    }
    if (latestSession) {
      const next = section(latestSession.body, 'Next task').split('\n')[0] || '—';
      out.push('## Last session', `- ${latestSession.data.summary} (${latestSession.data.id.slice(0, 10)}, ${latestSession.data.branch})`, `- Next task: ${next}`, '');
    }
    out.push('Full index: .continuation/INDEX.md. Records: .continuation/{type}/. Filter by tag with grep.');
    return out;
  };

  let limit = PER_TYPE;
  let lines = build(limit);
  while (lines.length > CAP && limit > 1) lines = build(--limit);
  return `${lines.slice(0, CAP).join('\n')}\n`;
}

const cell = (s) => String(s).replace(/\|/g, '\\|');

export function renderIndex({ records, invalid }) {
  const row = (r) => `| ${r.data.id} | ${r.type} | ${r.data.tags.join(', ')} | ${cell(r.data.summary)} |`;
  const active = records.filter((r) => r.data.status === 'active');
  const history = records.filter((r) => r.data.status !== 'active');
  const out = ['# Continuation index', '', '| id | type | tags | summary |', '|---|---|---|---|', ...active.map(row), ''];
  if (history.length) {
    out.push('## History', '', '| id | type | status | superseded_by | summary |', '|---|---|---|---|---|');
    for (const r of history) out.push(`| ${r.data.id} | ${r.type} | ${r.data.status} | ${r.data.superseded_by} | ${cell(r.data.summary)} |`);
    out.push('');
  }
  if (invalid.length) {
    out.push('## Invalid', '');
    for (const i of invalid) out.push(`- ${i.file}: ${i.reasons.join('; ')}`);
    out.push('');
  }
  return `${out.join('\n')}\n`;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/render.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/render.mjs continuation/scripts/test/render.test.mjs
git commit -m "feat(continuation): render HOT.md and INDEX.md"
```

---

### Task 7: `rebuild` command

**Files:**
- Create: `continuation/scripts/lib/commands/rebuild.mjs` (replace stub), `continuation/scripts/test/rebuild.test.mjs`

**Interfaces:**
- Consumes: `loadAll`, `renderHot`, `renderIndex`, `repoRoot`.
- Produces: `rebuild(root) → { hot, index, records, invalid }` (exported for other commands); CLI `rebuild [dir] [--if-stale] [--print-hot]`. `--if-stale` skips when `HOT.md` is newer than every record file. Exit 0 when `.continuation/` is absent, printing one line to stderr.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rebuild, run } from '../lib/commands/rebuild.mjs';
import { makeTempRepo, writeRecord } from './helpers.mjs';

test('rebuild writes HOT.md and INDEX.md', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    writeRecord(dir, 'decision', '2026-09-08T000000-a', { summary: 'use pint' });
    rebuild(dir);
    assert.match(fs.readFileSync(path.join(dir, '.continuation/HOT.md'), 'utf8'), /use pint/);
    assert.match(fs.readFileSync(path.join(dir, '.continuation/INDEX.md'), 'utf8'), /2026-09-08T000000-a/);
  } finally { cleanup(); }
});

test('--if-stale skips when HOT is fresh', async () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    writeRecord(dir, 'decision', '2026-09-08T000000-a', {});
    rebuild(dir);
    const hot = path.join(dir, '.continuation/HOT.md');
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(hot, future, future);
    fs.writeFileSync(hot, 'sentinel');
    fs.utimesSync(hot, future, future);
    await run({ flags: { 'if-stale': true }, positional: [dir], cwd: dir, stdout: { write() {} } });
    assert.equal(fs.readFileSync(hot, 'utf8'), 'sentinel');
  } finally { cleanup(); }
});

test('--print-hot prints and missing folder exits 0', async () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    let out = '';
    const code = await run({ flags: { 'print-hot': true }, positional: [dir], cwd: dir, stdout: { write: (s) => { out += s; } } });
    assert.equal(code, 0);
    assert.equal(out, '');
    writeRecord(dir, 'convention', '2026-09-08T000000-c', { summary: 'conventional commits' });
    await run({ flags: { 'print-hot': true }, positional: [dir], cwd: dir, stdout: { write: (s) => { out += s; } } });
    assert.match(out, /conventional commits/);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/rebuild.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
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
  if (!fs.existsSync(hot)) return true;
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
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/rebuild.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/commands/rebuild.mjs continuation/scripts/test/rebuild.test.mjs
git commit -m "feat(continuation): rebuild command with --if-stale and --print-hot"
```

---

### Task 8: `init` command and the AGENTS.md contract

**Files:**
- Create: `continuation/skills/continuation/references/agents-contract.md`, `continuation/scripts/lib/commands/init.mjs` (replace stub), `continuation/scripts/test/init.test.mjs`

**Interfaces:**
- Consumes: `rebuild`, `memDir`.
- Produces: `init(root) → { created: string[] }`; scaffolds four type folders, copies the contract to `.continuation/AGENTS.md` (skip if present), appends the two gitignore lines once, runs rebuild. Idempotent.

- [ ] **Step 1: Write the contract template**

`continuation/skills/continuation/references/agents-contract.md`:

```markdown
# .continuation/ — project memory contract

This folder is the project's memory for any coding agent. Read this file, then read
`HOT.md`. Do not read anything else until a task needs it.

## Layout

- `decisions/`, `learnings/`, `conventions/`, `sessions/` — one markdown record per file.
- `HOT.md` — derived summary, ≤ 40 lines, gitignored. Rebuild if missing or stale.
- `INDEX.md` — derived table of every record, gitignored.
- `AGENTS.md` — this file.

## Record

Frontmatter fields: `id, type, status, tags, summary, branch, files, supersedes,
superseded_by, confidence, auto`. Filename equals `id` plus `.md`, where `id` is
`YYYY-MM-DDTHHMMSS-slug` in local time. Body sections by type:

- decision: `## Context`, `## Decision`, `## Consequences`
- learning: `## What happened`, `## Rule`, `## Example` (optional)
- convention: `## Rule`, `## Why`, `## Example` (optional)
- session: `## What was done`, `## Current state`, `## Next task`, `## Key files`, `## Notes` (optional)

## Reading

1. Read `HOT.md` at the start of every session.
2. Before proposing an approach on anything non-trivial, grep `INDEX.md` for the task's
   tags or file paths and open only the matching records.
3. To resume work, read the newest `sessions/` record on the current branch, else the
   newest overall, and say which rule applied.

## Writing

Write a record, without asking, when:

- a choice between alternatives was made and it affects future work → `decision`
- something failed for a non-obvious reason and the fix is reusable → `learning`
- a "we always / we never" rule was stated or discovered → `convention`
- a commit or PR lands, the user says "done for now", or the session ends → `session`

Rules: one fact per record. Never write from speculation. Check `INDEX.md` for a live
record on the same subject first; if one exists, set `supersedes` on the new record and
mark the old one `status: superseded`, `superseded_by: <new id>`. Reuse existing tags
before inventing one. Say in one line what you remembered and where. Never delete a
record; retire it with `status: retired`.

If the helper is available, use it: `node <plugin>/scripts/continuation.mjs write …`
and `… rebuild`. Otherwise write the file by hand following the schema above and
regenerate `HOT.md` and `INDEX.md` from the frontmatter.

## Merging

Records never share a file. Derived files are not committed. If two branches supersede
the same record differently, keep both new records active and let review sort it out.
```

- [ ] **Step 2: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { init } from '../lib/commands/init.mjs';
import { makeTempRepo } from './helpers.mjs';

test('init scaffolds folders, AGENTS.md, gitignore, HOT and INDEX', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    for (const f of ['decisions', 'learnings', 'conventions', 'sessions']) assert.ok(fs.existsSync(path.join(dir, '.continuation', f)));
    assert.match(fs.readFileSync(path.join(dir, '.continuation/AGENTS.md'), 'utf8'), /project memory contract/);
    assert.ok(fs.existsSync(path.join(dir, '.continuation/HOT.md')));
    const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.match(gi, /^\.continuation\/HOT\.md$/m);
    assert.match(gi, /^\.continuation\/INDEX\.md$/m);
  } finally { cleanup(); }
});

test('init is idempotent and preserves an edited AGENTS.md', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    fs.writeFileSync(path.join(dir, '.continuation/AGENTS.md'), 'custom');
    init(dir);
    assert.equal(fs.readFileSync(path.join(dir, '.continuation/AGENTS.md'), 'utf8'), 'custom');
    const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.equal(gi.match(/HOT\.md/g).length, 1);
  } finally { cleanup(); }
});
```

- [ ] **Step 3: Run to see it fail**

Run: `node --test continuation/scripts/test/init.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement**

```js
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
```

- [ ] **Step 5: Run to see it pass**

Run: `node --test continuation/scripts/test/init.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add continuation/skills/continuation/references/agents-contract.md continuation/scripts/lib/commands/init.mjs continuation/scripts/test/init.test.mjs
git commit -m "feat(continuation): init command and AGENTS.md contract"
```

---

### Task 9: `write` command

**Files:**
- Create: `continuation/scripts/lib/commands/write.mjs` (replace stub), `continuation/scripts/test/write.test.mjs`

**Interfaces:**
- Consumes: `writeRecord`, `supersede`, `rebuild`, `branch`, `slugify`, `stamp`.
- Produces: `write(root, { type, tags, summary, body, files?, supersedes?, confidence?, slug?, auto? }) → { file, id }`. CLI reads the body from stdin. Auto-inits the folder if missing. Prints `Remembered: {summary} ({relative file})`.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { write } from '../lib/commands/write.mjs';
import { parse } from '../lib/frontmatter.mjs';
import { makeTempRepo, writeRecord as fixture } from './helpers.mjs';

test('write creates a record with branch, defaults and rebuilt HOT', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    const { file, id } = write(dir, { type: 'decision', tags: ['stripe', 'webhooks'], summary: 'Use the SDK for signatures', body: '## Context\nx\n## Decision\ny\n## Consequences\nz\n' });
    const d = parse(fs.readFileSync(file, 'utf8')).data;
    assert.equal(d.id, id);
    assert.match(id, /^\d{4}-\d{2}-\d{2}T\d{6}-use-the-sdk-for-signatures$/);
    assert.equal(d.branch, 'main');
    assert.equal(d.confidence, 'medium');
    assert.equal(d.auto, false);
    assert.match(fs.readFileSync(path.join(dir, '.continuation/HOT.md'), 'utf8'), /Use the SDK/);
  } finally { cleanup(); }
});

test('write with supersedes flips the old record and links', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    fixture(dir, 'decision', '2026-09-01T000000-old', {});
    const { file, id } = write(dir, { type: 'decision', tags: ['a'], summary: 'new', body: '## Decision\nx\n', supersedes: '2026-09-01T000000-old' });
    assert.equal(parse(fs.readFileSync(file, 'utf8')).data.supersedes, '2026-09-01T000000-old');
    const old = parse(fs.readFileSync(path.join(dir, '.continuation/decisions/2026-09-01T000000-old.md'), 'utf8')).data;
    assert.equal(old.status, 'superseded');
    assert.equal(old.superseded_by, id);
  } finally { cleanup(); }
});

test('write rejects bad input with a clear error', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    assert.throws(() => write(dir, { type: 'poem', tags: ['a'], summary: 's', body: 'x' }), /type/);
    assert.throws(() => write(dir, { type: 'decision', tags: [], summary: 's', body: 'x' }), /tags/);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/write.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
import fs from 'node:fs';
import path from 'node:path';
import { writeRecord, supersede, memDir } from '../records.mjs';
import { branch } from '../git.mjs';
import { slugify, stamp } from '../slug.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';
import { init } from './init.mjs';

export function write(root, { type, tags, summary, body, files = [], supersedes = '—', confidence = 'medium', slug, auto = false, when = new Date() }) {
  if (!fs.existsSync(memDir(root))) init(root);
  const id = `${stamp(when)}-${slugify(slug ?? summary)}`;
  const data = { id, type, status: 'active', tags, summary, branch: branch(root), files, supersedes, superseded_by: '—', confidence, auto };
  const file = writeRecord(root, data, body);
  const finalId = path.basename(file, '.md');
  if (supersedes && supersedes !== '—') supersede(root, supersedes, finalId);
  rebuild(root);
  return { file, id: finalId };
}

async function readStdin(stdin) {
  if (stdin.isTTY) return '';
  let s = '';
  for await (const chunk of stdin) s += chunk;
  return s;
}

const list = (v) => (typeof v === 'string' && v.length ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export async function run({ flags, positional, cwd, stdin, stdout }) {
  const root = resolveRoot(cwd, positional);
  const body = flags.body ?? (await readStdin(stdin));
  if (!body.trim()) throw new Error('body required on stdin or --body');
  const { file } = write(root, {
    type: flags.type, tags: list(flags.tags), summary: flags.summary, body,
    files: list(flags.files), supersedes: flags.supersedes ?? '—', confidence: flags.confidence ?? 'medium',
    slug: flags.slug, auto: flags.auto === true || flags.auto === 'true',
  });
  stdout.write(`Remembered: ${flags.summary} (${path.relative(root, file)})\n`);
  return 0;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/write.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/commands/write.mjs continuation/scripts/test/write.test.mjs
git commit -m "feat(continuation): write command with supersession"
```

---

### Task 10: `checkpoint` command

**Files:**
- Create: `continuation/scripts/lib/commands/checkpoint.mjs` (replace stub), `continuation/scripts/test/checkpoint.test.mjs`

**Interfaces:**
- Consumes: `write`, `loadAll`, `snapshot`, `isoStamp`.
- Produces: `checkpoint(root, { now = new Date() }) → { file } | { skipped: reason }`. Writes a `session` with `auto: true`, `confidence: low`, summary `Auto checkpoint at HH:MM`, tags `[checkpoint, <branch-slug>]`, body from git snapshot, `## Next task` and `## Key files` copied from the newest session on the same branch. Skips when a session on the branch is under 10 minutes old, or `.continuation/` is absent.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkpoint } from '../lib/commands/checkpoint.mjs';
import { init } from '../lib/commands/init.mjs';
import { parse } from '../lib/frontmatter.mjs';
import { makeTempRepo, writeRecord } from './helpers.mjs';

test('checkpoint writes an auto session with git state and carried-forward next task', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    writeRecord(dir, 'session', '2026-09-01T000000-prev', { branch: 'main', summary: 'prev' }, '## What was done\n- a\n\n## Next task\nFinish the webhook test\n\n## Key files\n- app/x.php — handler\n');
    fs.writeFileSync(path.join(dir, 'dirty.txt'), 'x');
    const r = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 15, 0) });
    const { data, body } = parse(fs.readFileSync(r.file, 'utf8'));
    assert.equal(data.type, 'session');
    assert.equal(data.auto, true);
    assert.equal(data.confidence, 'low');
    assert.equal(data.summary, 'Auto checkpoint at 09:15');
    assert.ok(data.tags.includes('checkpoint'));
    assert.match(body, /## Current state[\s\S]*\?\? dirty\.txt/);
    assert.match(body, /## Next task\nFinish the webhook test/);
    assert.match(body, /## Key files\n- app\/x\.php — handler/);
  } finally { cleanup(); }
});

test('checkpoint skips when a recent session exists on the branch', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    const first = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 0, 0) });
    assert.ok(first.file);
    const second = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 5, 0) });
    assert.equal(second.skipped, 'recent session on branch');
    const third = checkpoint(dir, { now: new Date(2026, 8, 8, 9, 11, 0) });
    assert.ok(third.file);
  } finally { cleanup(); }
});

test('checkpoint without .continuation/ skips', () => {
  const { dir, cleanup } = makeTempRepo();
  try { assert.equal(checkpoint(dir).skipped, 'not initialised'); } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/checkpoint.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
import fs from 'node:fs';
import { loadAll, memDir } from '../records.mjs';
import { snapshot } from '../git.mjs';
import { slugify } from '../slug.mjs';
import { write } from './write.mjs';
import { resolveRoot } from './rebuild.mjs';

const TEN_MIN = 10 * 60 * 1000;

function idToDate(id) {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : new Date(0);
}

function section(body, heading) {
  const m = body.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

export function checkpoint(root, { now = new Date() } = {}) {
  if (!fs.existsSync(memDir(root))) return { skipped: 'not initialised' };
  const snap = snapshot(root);
  const sessions = loadAll(root).records.filter((r) => r.type === 'session' && r.data.branch === snap.branch);
  const latest = sessions[0];
  if (latest && now - idToDate(latest.data.id) < TEN_MIN) return { skipped: 'recent session on branch' };
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const next = latest ? section(latest.body, 'Next task') : '';
  const keyFiles = latest ? section(latest.body, 'Key files') : '';
  const fence = (s) => (s ? `\`\`\`\n${s}\n\`\`\`` : '—');
  const body = [
    '## What was done', '- Auto checkpoint written by a hook. No narrative captured.', '',
    '## Current state', `- **Branch:** ${snap.branch}`, `- **Uncommitted changes:**`, fence(snap.status), '- **Recent commits:**', fence(snap.log), '- **Diff stat:**', fence(snap.diffStat), '',
    '## Next task', next || '— (no prior session on this branch)', '',
    '## Key files', keyFiles || '—', '',
  ].join('\n');
  const { file } = write(root, {
    type: 'session', tags: ['checkpoint', slugify(snap.branch, { max: 3 })].filter((t, i, a) => a.indexOf(t) === i),
    summary: `Auto checkpoint at ${hhmm}`, body, confidence: 'low', auto: true, slug: 'auto-checkpoint', when: now,
  });
  return { file };
}

export async function run({ positional, cwd, stdout }) {
  const r = checkpoint(resolveRoot(cwd, positional));
  stdout.write(r.file ? `checkpoint: ${r.file}\n` : `checkpoint skipped: ${r.skipped}\n`);
  return 0;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/checkpoint.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/commands/checkpoint.mjs continuation/scripts/test/checkpoint.test.mjs
git commit -m "feat(continuation): hook-driven checkpoint command"
```

---

### Task 11: `review` report

**Files:**
- Create: `continuation/scripts/lib/commands/review.mjs` (replace stub), `continuation/scripts/test/review.test.mjs`

**Interfaces:**
- Consumes: `loadAll`, `rebuild`, git.
- Produces: `report(root, { now }) → { conflictCandidates: [[idA, idB]], stale: [{id, reason}], thin: [{id, reason}], orphanTags: [{tag, id}], chains: [{tag, length, ids}] }`. CLI prints markdown by default, JSON with `--json`. Conflict *candidates* are pairs of active records sharing their first tag and type; the model judges whether they contradict.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { report } from '../lib/commands/review.mjs';
import { init } from '../lib/commands/init.mjs';
import { makeTempRepo, writeRecord } from './helpers.mjs';

test('review finds candidates, stale files, thin, orphans, chains, old checkpoints', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    init(dir);
    writeRecord(dir, 'decision', '2026-09-01T000000-a', { tags: ['stripe', 'x'], summary: 'use sdk' }, '## Decision\nlong\nenough\nbody\n');
    writeRecord(dir, 'decision', '2026-09-02T000000-b', { tags: ['stripe', 'y'], summary: 'hand roll hmac' }, '## Decision\nlong\nenough\nbody\n');
    writeRecord(dir, 'learning', '2026-09-03T000000-c', { tags: ['ddev'], files: ['gone/file.php'] }, '## Rule\nx\n');
    writeRecord(dir, 'convention', '2026-09-04T000000-d', { tags: ['pint'], confidence: 'low' }, '## Rule\nlong\nenough\nbody\n');
    for (let i = 1; i <= 4; i++) writeRecord(dir, 'convention', `2026-08-0${i}T000000-chain`, { tags: ['commits'], status: i < 4 ? 'superseded' : 'active', superseded_by: i < 4 ? `2026-08-0${i + 1}T000000-chain` : '—', supersedes: i > 1 ? `2026-08-0${i - 1}T000000-chain` : '—' }, '## Rule\nlong\nenough\nbody\n');
    writeRecord(dir, 'session', '2026-08-20T000000-auto-checkpoint', { tags: ['checkpoint'], auto: true, confidence: 'low', summary: 'Auto checkpoint at 09:00' }, '## What was done\n- auto\n## Next task\n—\n');
    const r = report(dir, { now: new Date(2026, 8, 8) });
    assert.deepEqual(r.conflictCandidates, [['2026-09-02T000000-b', '2026-09-01T000000-a']]);
    assert.ok(r.stale.some((s) => s.id === '2026-09-03T000000-c' && /gone\/file\.php/.test(s.reason)));
    assert.ok(r.thin.some((t) => t.id === '2026-09-04T000000-d' && /low/.test(t.reason)));
    assert.ok(r.thin.some((t) => t.id === '2026-09-03T000000-c' && /short/.test(t.reason)));
    assert.ok(r.thin.some((t) => t.id === '2026-08-20T000000-auto-checkpoint' && /checkpoint/.test(t.reason)));
    assert.ok(r.orphanTags.some((o) => o.tag === 'ddev'));
    assert.ok(!r.orphanTags.some((o) => o.tag === 'stripe'));
    assert.deepEqual(r.chains.map((c) => c.tag), ['commits']);
    assert.equal(r.chains[0].length, 4);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/review.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
import fs from 'node:fs';
import path from 'node:path';
import { loadAll } from '../records.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';

const DAY = 86_400_000;
function idToDate(id) {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : new Date(0);
}

export function report(root, { now = new Date() } = {}) {
  const { records } = loadAll(root);
  const active = records.filter((r) => r.data.status === 'active');

  const conflictCandidates = [];
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i], b = active[j];
    if (a.type === b.type && a.type !== 'session' && a.data.tags[0] === b.data.tags[0]) conflictCandidates.push([a.data.id, b.data.id]);
  }

  const stale = [];
  for (const r of active) {
    const missing = (r.data.files ?? []).filter((f) => !fs.existsSync(path.join(root, f)));
    if (missing.length) stale.push({ id: r.data.id, reason: `files missing: ${missing.join(', ')}` });
  }

  const thin = [];
  for (const r of active) {
    const bodyLines = r.body.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
    if (r.data.confidence === 'low' && !r.data.auto) thin.push({ id: r.data.id, reason: 'confidence low' });
    if (bodyLines < 3) thin.push({ id: r.data.id, reason: `body short (${bodyLines} lines)` });
    if (r.data.auto && now - idToDate(r.data.id) > 7 * DAY) thin.push({ id: r.data.id, reason: 'auto checkpoint older than 7 days' });
  }

  const tagCount = new Map();
  for (const r of active) for (const t of r.data.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const orphanTags = [];
  for (const r of active) for (const t of r.data.tags) if (tagCount.get(t) === 1) orphanTags.push({ tag: t, id: r.data.id });

  const byId = new Map(records.map((r) => [r.data.id, r]));
  const chains = [];
  for (const r of active) {
    const ids = [r.data.id];
    let cur = r;
    while (cur && cur.data.supersedes && cur.data.supersedes !== '—' && byId.has(cur.data.supersedes)) { cur = byId.get(cur.data.supersedes); ids.push(cur.data.id); }
    if (ids.length > 3) chains.push({ tag: r.data.tags[0], length: ids.length, ids });
  }

  return { conflictCandidates, stale, thin, orphanTags, chains };
}

export function toMarkdown(r) {
  const out = ['# Continuation review', ''];
  const sec = (title, rows) => { out.push(`## ${title} (${rows.length})`, ''); for (const row of rows) out.push(`- ${row}`); out.push(''); };
  sec('Conflict candidates — read both, decide if they contradict', r.conflictCandidates.map(([a, b]) => `${a} ↔ ${b}`));
  sec('Stale', r.stale.map((s) => `${s.id}: ${s.reason}`));
  sec('Thin', r.thin.map((t) => `${t.id}: ${t.reason}`));
  sec('Orphan tags', r.orphanTags.map((o) => `${o.tag} (only on ${o.id})`));
  sec('Long supersession chains', r.chains.map((c) => `${c.tag}: ${c.length} records — ${c.ids.join(' ← ')}`));
  return `${out.join('\n')}\n`;
}

export async function run({ flags, positional, cwd, stdout }) {
  const root = resolveRoot(cwd, positional);
  rebuild(root);
  const r = report(root);
  stdout.write(flags.json ? `${JSON.stringify(r, null, 2)}\n` : toMarkdown(r));
  return 0;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/review.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/commands/review.mjs continuation/scripts/test/review.test.mjs
git commit -m "feat(continuation): review report for conflicts, stale, thin, orphans, chains"
```

---

### Task 12: `migrate` for one repo

**Files:**
- Create: `continuation/scripts/lib/commands/migrate.mjs` (replace stub), `continuation/scripts/test/migrate.test.mjs`

**Interfaces:**
- Consumes: `writeRecord`, `init`, `rebuild`, `firstCommitDate`, `slugify`, `stamp`, `parse`.
- Produces: `migrateRepo(root) → { sessions, learnings, splits, skipped, notes: string[] }`. Reads `.claude/continuations/*.md` and `.claude/learnings/*.md`. Rules from spec §11. `migrateAll(rootDir) → [{ repo, ...counts }]` in Task 13.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { migrateRepo } from '../lib/commands/migrate.mjs';
import { loadAll } from '../lib/records.mjs';
import { makeTempRepo } from './helpers.mjs';

function seed(dir) {
  const c = path.join(dir, '.claude/continuations'); const l = path.join(dir, '.claude/learnings');
  fs.mkdirSync(c, { recursive: true }); fs.mkdirSync(l, { recursive: true });
  fs.writeFileSync(path.join(c, '2026-05-05-ddev-setup.md'), '# Continuation: Proj — DDEV setup\n\n**Session date:** 2026-05-05\n\n## What was completed this session\n- a\n\n## Next task\nDo b\n');
  fs.writeFileSync(path.join(c, '2026-06-21T143052-stripe-webhooks.md'), '# Proj — Stripe webhooks\n\n## What was done this session\n- x\n\n## Next task\nDo y\n');
  fs.writeFileSync(path.join(l, '2026-05-05-ddev-gotchas.md'), '# Learnings — DDEV\n\n## Port clash\n- **What happened:** p\n- **Rule:** r\n');
  fs.writeFileSync(path.join(l, 'worktree-and-ddev-gotchas.md'), '# Worktree & DDEV Gotchas\n\nintro\n\n---\n\n## Bug: Composer clobbers autoload\n- **Symptom:** s\n- **Fix:** f\n\n## Bug: Pest parallel DB\n- **Symptom:** s2\n- **Fix:** f2\n');
  fs.writeFileSync(path.join(l, 'notes.txt'), 'ignored');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'seed'], { cwd: dir });
}

test('migrate imports sessions, learnings, splits undated files, idempotent', () => {
  const { dir, cleanup } = makeTempRepo();
  try {
    seed(dir);
    const r = migrateRepo(dir);
    assert.equal(r.sessions, 2);
    assert.equal(r.learnings, 1);
    assert.equal(r.splits, 2);
    const { records, invalid } = loadAll(dir);
    assert.equal(invalid.length, 0);
    const ids = records.map((x) => x.data.id);
    assert.ok(ids.includes('2026-05-05T000000-ddev-setup'));
    assert.ok(ids.includes('2026-06-21T143052-stripe-webhooks'));
    assert.ok(ids.includes('2026-05-05T000000-ddev-gotchas'));
    const split = records.filter((x) => x.data.tags.includes('worktree'));
    assert.equal(split.length, 2);
    assert.ok(split.every((x) => x.data.confidence === 'medium' && x.data.branch === '—'));
    assert.ok(split.some((x) => /composer/.test(x.data.summary.toLowerCase())));
    const ses = records.find((x) => x.data.id === '2026-05-05T000000-ddev-setup');
    assert.match(ses.body, /## What was completed this session/);
    assert.equal(ses.data.summary, 'Proj — DDEV setup');
    assert.ok(fs.existsSync(path.join(dir, '.claude/continuations/2026-05-05-ddev-setup.md')));
    const again = migrateRepo(dir);
    assert.deepEqual([again.sessions, again.learnings, again.splits], [0, 0, 0]);
    assert.equal(loadAll(dir).records.length, records.length);
  } finally { cleanup(); }
});

test('migrate on a repo with nothing to migrate reports zeros', () => {
  const { dir, cleanup } = makeTempRepo();
  try { assert.deepEqual(migrateRepo(dir), { sessions: 0, learnings: 0, splits: 0, skipped: 0, notes: ['nothing to migrate'] }); } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/migrate.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../frontmatter.mjs';
import { writeRecord, loadAll, memDir } from '../records.mjs';
import { firstCommitDate, repoRoot } from '../git.mjs';
import { slugify, stamp } from '../slug.mjs';
import { init } from './init.mjs';
import { rebuild, resolveRoot } from './rebuild.mjs';

const DATED = /^(\d{4}-\d{2}-\d{2})(T\d{6})?-(.+)\.md$/;

function h1(text) { const m = text.match(/^#\s+(.+)$/m); return m ? m[1].replace(/^(Continuation|Learnings?)\s*[:—-]\s*/i, '').trim() : ''; }
function stripH1(text) { return text.replace(/^#\s+.+\n+/, ''); }
function trim120(s) { return s.length > 120 ? `${s.slice(0, 117)}…` : s; }
function tagsFrom(...parts) {
  const words = parts.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !/^(and|the|for|with|bug|gotchas?|notes?|session)$/.test(w));
  return [...new Set(words)].slice(0, 6);
}

function importDated(root, type, file, name, existing) {
  const [, date, time, slug] = name.match(DATED);
  const id = `${date}${time ?? 'T000000'}-${slugify(slug)}`;
  if (existing.has(id)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const body = stripH1(text);
  const summary = trim120(h1(text) || slug.replace(/-/g, ' '));
  writeRecord(root, { id, type, status: 'active', tags: tagsFrom(slug), summary, branch: '—', files: [], supersedes: '—', superseded_by: '—', confidence: 'medium', auto: false }, body);
  return id;
}

function importSplit(root, file, name, existing) {
  const text = fs.readFileSync(file, 'utf8');
  const base = name.replace(/\.md$/, '');
  const when = firstCommitDate(root, path.relative(root, file)) ?? fs.statSync(file).mtime;
  const prefix = stamp(when);
  const parts = text.split(/^(?=## )/m).filter((p) => p.startsWith('## '));
  let count = 0;
  for (const part of parts) {
    const title = part.match(/^##\s+(.+)$/m)[1].replace(/^(bug|gotcha|lesson)\s*:\s*/i, '').trim();
    const id = `${prefix}-${slugify(`${base} ${title}`)}`;
    if (existing.has(id)) continue;
    writeRecord(root, { id, type: 'learning', status: 'active', tags: tagsFrom(base, title), summary: trim120(title), branch: '—', files: [], supersedes: '—', superseded_by: '—', confidence: 'medium', auto: false }, part.replace(/^##\s+.+\n/, '## What happened\n'));
    count++;
  }
  return count;
}

export function migrateRepo(root) {
  const src = { sessions: path.join(root, '.claude/continuations'), learnings: path.join(root, '.claude/learnings') };
  const out = { sessions: 0, learnings: 0, splits: 0, skipped: 0, notes: [] };
  if (!fs.existsSync(src.sessions) && !fs.existsSync(src.learnings)) { out.notes.push('nothing to migrate'); return out; }
  if (!fs.existsSync(memDir(root))) init(root);
  const existing = new Set(loadAll(root).records.map((r) => r.data.id));
  const known = new Set(existing);
  for (const [key, type] of [['sessions', 'session'], ['learnings', 'learning']]) {
    if (!fs.existsSync(src[key])) continue;
    for (const name of fs.readdirSync(src[key]).sort()) {
      const file = path.join(src[key], name);
      if (!name.endsWith('.md') || name.startsWith('.')) { out.skipped++; continue; }
      if (DATED.test(name)) {
        const id = importDated(root, type, file, name, known);
        if (id) { known.add(id); out[key]++; }
      } else if (type === 'learning') {
        out.splits += importSplit(root, file, name, known);
      } else { out.skipped++; out.notes.push(`skipped undated session ${name}`); }
    }
  }
  rebuild(root);
  return out;
}

export async function run({ flags, positional, cwd, stdout }) {
  if (flags.all) {
    const { migrateAll } = await import('./migrate-all.mjs');
    const rows = migrateAll(path.resolve(cwd, String(flags.all)));
    stdout.write('| repo | sessions | learnings | splits | skipped |\n|---|---|---|---|---|\n');
    for (const r of rows) stdout.write(`| ${r.repo} | ${r.sessions} | ${r.learnings} | ${r.splits} | ${r.skipped} |\n`);
    stdout.write('\nSources untouched. Delete .claude/continuations/ and .claude/learnings/ per repo when satisfied.\n');
    return 0;
  }
  const root = resolveRoot(cwd, positional);
  const r = migrateRepo(root);
  stdout.write(`migrated ${root}: ${r.sessions} sessions, ${r.learnings} learnings, ${r.splits} split learnings, ${r.skipped} skipped\n${r.notes.map((n) => `  ${n}`).join('\n')}${r.notes.length ? '\n' : ''}`);
  if (r.sessions + r.learnings + r.splits) stdout.write('Sources untouched. Delete .claude/continuations/ and .claude/learnings/ when satisfied.\n');
  return 0;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/migrate.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/commands/migrate.mjs continuation/scripts/test/migrate.test.mjs
git commit -m "feat(continuation): migrate one repo from .claude/continuations and learnings"
```

---

### Task 13: `migrate --all`

**Files:**
- Create: `continuation/scripts/lib/commands/migrate-all.mjs`, `continuation/scripts/test/migrate-all.test.mjs`

**Interfaces:**
- Consumes: `migrateRepo`.
- Produces: `migrateAll(rootDir) → [{ repo, sessions, learnings, splits, skipped }]`, walking up to 3 levels for directories containing `.git` and either old folder. Skips `node_modules`, `vendor`, `.git`. Never commits.

- [ ] **Step 1: Write failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { migrateAll } from '../lib/commands/migrate-all.mjs';
import { makeTempRepo } from './helpers.mjs';

test('migrateAll finds nested repos with old folders and skips the rest', () => {
  const { dir, cleanup } = makeTempRepo({ git: false });
  try {
    for (const name of ['work/a', 'work/b', 'c']) {
      const r = path.join(dir, name);
      fs.mkdirSync(r, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: r });
    }
    fs.mkdirSync(path.join(dir, 'work/a/.claude/continuations'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'work/a/.claude/continuations/2026-01-01-x.md'), '# X\n\n## Next task\nn\n');
    fs.mkdirSync(path.join(dir, 'c/.claude/learnings'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'c/.claude/learnings/2026-01-02-y.md'), '# Y\n\n## Rule\nr\n');
    fs.mkdirSync(path.join(dir, 'work/b/node_modules/z/.claude/continuations'), { recursive: true });
    const rows = migrateAll(dir);
    assert.deepEqual(rows.map((r) => [r.repo, r.sessions, r.learnings]).sort(), [['c', 0, 1], ['work/a', 1, 0]]);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test continuation/scripts/test/migrate-all.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
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
  if (hasGit && hasOld) { out.push(dir); return; }
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
```

- [ ] **Step 4: Run to see it pass**

Run: `node --test continuation/scripts/test/migrate-all.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add continuation/scripts/lib/commands/migrate-all.mjs continuation/scripts/test/migrate-all.test.mjs
git commit -m "feat(continuation): migrate --all walks a directory of repos"
```

---

### Task 14: Slash commands `/end`, `/continue`, `/remember`, `/continuation-review`

**Files:**
- Modify: `continuation/commands/end.md`, `continuation/commands/continue.md`
- Create: `continuation/commands/remember.md`, `continuation/commands/continuation-review.md`
- Keep: `continuation/commands/next.md` unchanged.

**Interfaces:**
- Consumes: the helper CLI. All commands reference it as `node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs"`.

- [ ] **Step 1: Replace `commands/end.md`**

```markdown
---
description: End the session — write a session record to .continuation/sessions/ and any decisions, learnings or conventions not yet captured.
allowed-tools: Bash(git:*), Bash(node:*), Bash(ls:*), Bash(test:*), Bash(grep:*), Read, AskUserQuestion
---

# /end — Session handoff

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs"`. Call it `CONT` below.

## 1. Capture

Run in parallel: `git rev-parse --abbrev-ref HEAD`, `git status --short`, `git log --oneline -5`, `git diff --stat`. Skip if not a git repo.

Review the conversation for: what was completed, what is unfinished, the next concrete task, key files, and any decision, learning or convention that was reached during the session but not yet written to `.continuation/`. Check `.continuation/INDEX.md` (read it, or `grep`) so you do not duplicate an existing record.

**Short-session guard:** if the session was brief (few messages, no commits, no edits) ask *"Short session — write a handoff anyway?"* Default no. If no, stop.

## 2. Write outstanding records first

For each uncaptured decision / learning / convention, pipe the body to:

```bash
CONT write --type <decision|learning|convention> --tags a,b --summary "<≤120 chars>" [--files p,q] [--supersedes <id>] [--confidence high|medium|low] <<'EOF'
## <sections for the type, see .continuation/AGENTS.md>
EOF
```

Print each "Remembered:" line the helper returns.

## 3. Write the session record

Draft it inline, then pipe it:

```bash
CONT write --type session --tags <2-4 topic tags> --summary "<topic in ≤120 chars>" --files <key files> --confidence high <<'EOF'
## What was done
- ...

## Current state
- **Working:** ...
- **Not yet:** ...
- **Uncommitted changes:** <from git status, or none>

## Next task
<one unambiguous instruction>

## Key files
- `path` — why

## Notes
<optional; omit heading if empty>
EOF
```

Keep it under 150 lines. Then print:

```
=== SESSION ENDED ===
Session:  <path the helper printed>
Records:  <n> new decision/learning/convention records
Next:     /continue
```

## Rules

- Never hand-edit `HOT.md` or `INDEX.md`; the helper rebuilds them.
- Do not lint, commit or push. Not this command's job.
- If the helper is missing, write the files by hand following `.continuation/AGENTS.md`.
```

- [ ] **Step 2: Replace `commands/continue.md`**

```markdown
---
description: Resume — read .continuation/HOT.md and the latest session record, reality-check the repo, orient.
allowed-tools: Bash(git:*), Bash(node:*), Bash(ls:*), Bash(test:*), Bash(grep:*), Read, AskUserQuestion
---

# /continue — Resume from the last session

Read-only apart from rebuilding the derived files.

## 1. Load memory

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" rebuild --if-stale --print-hot
```

If it prints nothing, `.continuation/` does not exist. Say so, offer `init` (and `migrate` if `.claude/continuations/` exists), read `CLAUDE.md`/`AGENTS.md` and `git log --oneline -10` as fallback orientation, and stop.

## 2. Pick the session record

From `.continuation/INDEX.md`, sessions are listed newest first. Choose:

1. The newest session whose `branch` equals the current branch and `auto: false`.
2. Else the newest session on the branch, even if `auto: true` (say it is an auto checkpoint).
3. Else the newest session overall (say it is from another branch).

If a non-auto session and a newer auto checkpoint both exist on the branch and the checkpoint is under 24 hours newer, read the non-auto one for narrative and the checkpoint's `## Current state` for git state.

Read the chosen file in full.

## 3. Reality-check

`git rev-parse --abbrev-ref HEAD`, `git status --short`, `git log --format="%h %ad %s" --date=short -5`. Compare with the record: branch mismatch, newer commits than the record's timestamp, working tree that does not match its "Uncommitted changes". Flag each; never auto-switch branches.

## 4. Orient

```
=== RESUMING SESSION ===

Project:        <from HOT.md header>
Last session:   <date> — <summary>   (<rule used: branch / branch-auto / newest>)
Branch:         <live>  <(mismatch — record said X)>
Working:        <from record>
Not yet:        <from record>
Uncommitted:    <live git status summary>
Next task:      <from record>

Key files:
  - <path> — <why>

Conventions and decisions in play: see HOT.md above.
```

## 5. Hand back

End with exactly: **"Ready to pick up from here, or doing something different?"** Then wait.
```

- [ ] **Step 3: Create `commands/remember.md`**

```markdown
---
description: Remember something — write a decision, learning or convention record to .continuation/ from what the user just said.
allowed-tools: Bash(node:*), Bash(grep:*), Bash(git:*), Read
argument-hint: <what to remember>
---

# /remember — Write a record now

`$ARGUMENTS` is the thing to remember. If empty, use the last substantive point in the conversation.

1. Classify: a choice between alternatives → `decision`; a non-obvious failure and its fix → `learning`; a "we always / never" rule → `convention`. If genuinely ambiguous, ask one question.
2. `grep -i "<key words>" .continuation/INDEX.md` to find a live record on the same subject. If one exists, you will supersede it.
3. Write it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" write --type <type> --tags <1-6 existing tags first> --summary "<≤120 chars>" [--files ...] [--supersedes <id>] --confidence high <<'EOF'
<body sections for the type per .continuation/AGENTS.md>
EOF
```

4. Print the helper's "Remembered:" line and nothing else.
```

- [ ] **Step 4: Create `commands/continuation-review.md`**

```markdown
---
description: Review project memory — conflicts, stale, thin, orphan tags and long chains in .continuation/, with one proposed action each.
allowed-tools: Bash(node:*), Bash(git:*), Bash(grep:*), Read, Edit, AskUserQuestion
---

# /continuation-review — Curate memory

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" review --json` and parse it.
2. **Conflict candidates:** for each pair, read both records. Decide whether they contradict. If they do not, drop the pair silently.
3. Present every remaining item in this priority order — conflicts, stale, thin, orphan tags, long chains — one line each with one proposed action: **keep**, **retire**, **merge**, **retag**. Use `AskUserQuestion` per item, or accept "apply all".
4. Apply:
   - **retire:** edit the record's frontmatter to `status: retired`. Never delete.
   - **merge:** write one new record with `write … --supersedes <id-a>` containing the merged body, then edit the other inputs to `status: superseded`, `superseded_by: <new id>`.
   - **retag:** edit `tags` in the frontmatter.
5. Run `… rebuild` and print counts: reviewed, retired, merged, retagged, kept.

Nothing is ever deleted by this command.
```

- [ ] **Step 5: Verify frontmatter of every command parses**

Run: `for f in continuation/commands/*.md; do head -1 "$f" | grep -q '^---$' && echo "ok $f" || echo "BAD $f"; done`
Expected: five `ok` lines.

- [ ] **Step 6: Commit**

```bash
git add continuation/commands
git commit -m "feat(continuation): slash commands end, continue, remember, continuation-review"
```

---

### Task 15: SKILL.md, record-schema reference, hooks, plugin docs

**Files:**
- Rewrite: `continuation/skills/continuation/SKILL.md` (move from `skills/claude-continuation/SKILL.md` with `git mv`)
- Create: `continuation/skills/continuation/references/record-schema.md`, `continuation/hooks/hooks.json`
- Rewrite: `continuation/README.md`, `continuation/MIGRATION.md`; prepend to `continuation/CHANGELOG.md`

- [ ] **Step 1: Move and rewrite SKILL.md**

```bash
git mv continuation/skills/claude-continuation continuation/skills/continuation
```

`continuation/skills/continuation/SKILL.md`:

```markdown
---
name: continuation
description: Project memory for any coding agent. Use at the start of every session (read .continuation/HOT.md), whenever a decision is made, a non-obvious failure is fixed, or a convention is stated (write a record without asking), and when the user says "remember this", "what did we decide about", "end the session", "continue", "pick up where we left off", or types /end, /continue, /remember, /continuation-review.
license: MIT
metadata:
  author: Amjad Pathan
  repository: https://github.com/amjad1233/ai-skills
---

# continuation

Memory lives in `.continuation/` at the repo root: one markdown record per fact under
`decisions/`, `learnings/`, `conventions/`, `sessions/`, plus derived `HOT.md` (≤ 40
lines) and `INDEX.md`. The contract every agent follows is `.continuation/AGENTS.md`.
Schema: `references/record-schema.md`.

Helper (zero deps, Node ≥ 18): `node <this-plugin>/scripts/continuation.mjs`. In Claude
Code that path is `${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs`. Installed via
skills.sh the scripts sit next to this file under `scripts/`. If no Node runtime exists,
follow the "by hand" notes below.

## At session start

Run `… rebuild --if-stale --print-hot` and read the output. By hand: read
`.continuation/HOT.md`; if missing, read the newest few records per type instead. If
`.continuation/` is absent but `.claude/continuations/` exists, offer `… migrate`.

## Before non-trivial work

`grep` `.continuation/INDEX.md` for the task's tags or file paths. Open matching records.
Mention any convention or decision that constrains the approach.

## While working — write without asking

| Trigger | Type |
|---|---|
| A choice between alternatives that affects future work | `decision` |
| A non-obvious failure with a reusable fix | `learning` |
| A "we always / we never" rule stated or discovered | `convention` |
| A commit or PR lands, or the user says "done for now" | `session` |

```bash
… write --type <type> --tags a,b --summary "<≤120 chars>" [--files p,q] [--supersedes <id>] [--confidence high|medium|low] <<'EOF'
<body sections for the type>
EOF
```

Then say one line: `Remembered: <summary> (<path>)`. Rules: one fact per record; never
from speculation; check INDEX.md for a live record on the subject and supersede it rather
than duplicate; reuse existing tags; never delete, retire instead.

By hand: create `.continuation/<type>s/<YYYY-MM-DDTHHMMSS>-<slug>.md` with the
frontmatter in `references/record-schema.md`, then regenerate HOT.md and INDEX.md.

## Ending a session

Follow `commands/end.md`: write outstanding records, then a `session` record with
`## What was done`, `## Current state`, `## Next task`, `## Key files`.

## Resuming

Follow `commands/continue.md`: hot file, newest session on the current branch (say which
rule picked it), read-only git reality check, orientation block, then stop and ask.

## Reviewing

Follow `commands/continuation-review.md`: `… review --json`, judge conflict candidates,
propose keep/retire/merge/retag per item, apply, rebuild.

## Not covered here

`/next` (open the next session in a fresh terminal) is macOS and Claude Code only. Hook-
driven auto checkpoints on context compaction are Claude Code only; other agents rely on
the "session record after each commit or PR" rule above.
```

- [ ] **Step 2: Create `references/record-schema.md`**

```markdown
# Record schema

Filename: `.continuation/<type>s/<id>.md`, `id = YYYY-MM-DDTHHMMSS-slug` (local time; slug
starts with a letter, lowercase letters, digits, hyphens, 2–5 words). Same-second
collisions append `-2`, `-3`. Never overwrite.

```yaml
---
id: 2026-09-08T083012-stripe-webhook-verification   # required, equals filename
type: decision          # required: decision | learning | convention | session
status: active          # required: active | superseded | retired
tags: [stripe, webhooks, security]                   # required, 1–6, lowercase kebab-case
summary: Verify Stripe signatures with the SDK, never hand-roll HMAC   # required, ≤ 120 chars
branch: feat/stripe     # branch at write time, — outside git
files: [app/Http/Controllers/StripeWebhookController.php]
supersedes: —           # id of the record this replaces
superseded_by: —        # set on the old record when replaced
confidence: high        # high | medium | low, set once at write time
auto: false             # true only on hook-written checkpoints
---
```

Body by type (keep decision/learning/convention under 60 lines, session under 150):

| type | sections |
|---|---|
| decision | `## Context`, `## Decision`, `## Consequences` |
| learning | `## What happened`, `## Rule`, `## Example` (optional) |
| convention | `## Rule`, `## Why`, `## Example` (optional) |
| session | `## What was done`, `## Current state`, `## Next task`, `## Key files`, `## Notes` (optional) |

Derived, gitignored, rebuilt by `rebuild`: `HOT.md` (header, ≤ 8 conventions, ≤ 8
decisions, ≤ 8 learnings, last session + next task, pointer line; hard cap 40 lines) and
`INDEX.md` (active table `| id | type | tags | summary |`, `## History` table for
superseded/retired, `## Invalid` list for files that failed to parse).
```

- [ ] **Step 3: Create `hooks/hooks.json`**

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs\" rebuild --if-stale --print-hot" } ] }
    ],
    "PreCompact": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs\" checkpoint" } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs\" checkpoint" } ] }
    ]
  }
}
```

- [ ] **Step 4: Rewrite README.md, MIGRATION.md, prepend CHANGELOG**

`continuation/README.md`:

```markdown
# continuation

Project memory for any coding agent. Decisions, learnings, conventions and session
handoffs live as typed markdown records in `.continuation/` at your repo root. The agent
writes them as it works, reads a 40-line `HOT.md` at every session start, and pulls
detail by tag only when a task needs it.

## Install

Claude Code:

```
/plugin marketplace add amjad1233/ai-skills
/plugin install continuation@amjad1233
```

opencode, Codex, Cursor, Gemini CLI and anything else that reads skills:

```
npx skills add amjad1233/ai-skills --skill continuation
```

Then in each repo: `node <plugin>/scripts/continuation.mjs init` (Claude Code:
`/continue` offers it). Coming from `claude-continuation`? See [MIGRATION.md](MIGRATION.md).

## Commands

| Command | Does |
|---|---|
| `/continue` | Load HOT.md, read the latest session on your branch, reality-check git, orient |
| `/end` | Write outstanding records, then the session handoff |
| `/remember <text>` | Write one decision / learning / convention now |
| `/continuation-review` | Conflicts, stale, thin, orphan tags, long chains — you decide keep / retire / merge / retag |
| `/next` | Open the next session in a fresh terminal (Claude Code, macOS) |

The agent also writes records on its own when a decision is made, a non-obvious failure
is fixed, a convention is stated, or a commit/PR lands. It says `Remembered: …` each time.

## Layout

```
.continuation/
├── AGENTS.md        # the contract, committed
├── HOT.md           # derived, gitignored, ≤ 40 lines
├── INDEX.md         # derived, gitignored
├── decisions/  learnings/  conventions/  sessions/
```

One file per record, YAML frontmatter, no author field. Two developers never touch the
same file, and the derived files are never committed, so git merges are additions only.

## Auto checkpoints (Claude Code)

Hooks on `PreCompact` and `SessionEnd` write a low-confidence session record from git
state so a compaction or a closed terminal never loses the branch and diff. `/end` still
captures the narrative.

## Helper

`scripts/continuation.mjs` — Node ≥ 18, zero dependencies. `init`, `rebuild`, `write`,
`checkpoint`, `review`, `migrate`. `--help` for flags. Tests: `node --test scripts/test/`.

MIT.
```

`continuation/MIGRATION.md`:

```markdown
# Migrating from claude-continuation to continuation 2.0

Handoffs move from `.claude/continuations/` and `.claude/learnings/` into
`.continuation/` as typed records with frontmatter.

One repo:

```
node <plugin>/scripts/continuation.mjs migrate
```

Every repo under a directory:

```
node <plugin>/scripts/continuation.mjs migrate --all ~/projects
```

What it does: timestamped and date-only files become one record each (date-only get
`T000000`), bodies copied verbatim; undated living learning files are split into one
learning per `##` section. Everything gets `confidence: medium`. Sources are left in
place; re-running is a no-op. Nothing is committed for you.

When satisfied: delete `.claude/continuations/` and `.claude/learnings/`, remove their
`.gitignore` lines if you had them, commit.

Plugin path: `claude-continuation@amjad1233` → `continuation@amjad1233`. Commands keep
their names; `/remember` and `/continuation-review` are new.
```

Prepend to `continuation/CHANGELOG.md` after the header:

```markdown
## [2.0.0] - 2026-09-08

Renamed `claude-continuation` → `continuation`. Session handoffs become one of four
record types in a project memory that any coding agent can read.

### Added
- `.continuation/` layout: `decisions/`, `learnings/`, `conventions/`, `sessions/`, one
  record per file with YAML frontmatter; derived `HOT.md` (≤ 40 lines) and `INDEX.md`.
- Autonomous writes: the agent records decisions, learnings and conventions as they
  happen and says `Remembered: …`.
- `/remember`, `/continuation-review`.
- Hook-driven auto checkpoints on `PreCompact` and `SessionEnd`.
- Zero-dependency helper `scripts/continuation.mjs` with `init`, `rebuild`, `write`,
  `checkpoint`, `review`, `migrate`, `migrate --all`.
- `.continuation/AGENTS.md` contract so opencode, Codex, Cursor and Gemini CLI follow
  the same rules.

### Changed
- **BREAKING:** storage moves from `.claude/continuations/` + `.claude/learnings/` to
  `.continuation/`. Run `migrate` (see MIGRATION.md).
- `/end` writes outstanding records before the handoff. `/continue` picks the newest
  session on the current branch and says which rule it used.

### Removed
- Author or dev-name fields: none, by design. Branch is the only provenance.
```

- [ ] **Step 5: Validate JSON and frontmatter**

Run: `node -e "JSON.parse(require('fs').readFileSync('continuation/hooks/hooks.json','utf8')); JSON.parse(require('fs').readFileSync('continuation/.claude-plugin/plugin.json','utf8')); console.log('json ok')" && head -3 continuation/skills/continuation/SKILL.md`
Expected: `json ok` and the SKILL frontmatter opening.

- [ ] **Step 6: Commit**

```bash
git add -A continuation
git commit -m "feat(continuation): portable skill, schema reference, hooks, docs"
```

---

### Task 16: Marketplace, root docs, landing page, retire the old spec

**Files:**
- Modify: `.claude-plugin/marketplace.json`, `README.md`, `docs/index.html`, `.gitignore`
- Rename: `docs/claude-continuation/` → `docs/continuation/`
- Move: `openspec/changes/add-continuation-standard/` → `openspec/changes/archive/2026-09-08-add-continuation-standard/`
- Modify: `docs/superpowers/specs/2026-06-21-continuation-standard-design.md` (status line only)

- [ ] **Step 1: Marketplace entry**

In `.claude-plugin/marketplace.json` replace the `claude-continuation` plugin object with:

```json
{
  "name": "continuation",
  "source": "./continuation",
  "description": "Project memory for any coding agent. Decisions, learnings, conventions and session handoffs as typed records in .continuation/, written autonomously, read in one hot file every session. /end, /continue, /remember, /continuation-review, /next.",
  "category": "workflow",
  "tags": ["memory", "session", "handoff", "continuation", "learnings", "decisions", "resume", "agents", "opencode", "codex", "cursor"]
}
```

- [ ] **Step 2: Root README**

Replace the `claude-continuation` table row with:

```markdown
| [**continuation**](continuation/) | Project memory for any coding agent. Typed decisions, learnings, conventions and session handoffs in `.continuation/`, written as you work and read in one hot file every session. `/end`, `/continue`, `/remember`, `/continuation-review`, `/next`. |
```

Update the roadmap: tick "Continuation for opencode & other agents" (already ticked), add `- [ ] Auto checkpoints for opencode via its plugin hooks`. Update the repo layout block: `claude-continuation/` → `continuation/`.

- [ ] **Step 3: Landing page and skill page**

```bash
git mv docs/claude-continuation docs/continuation
```

In `docs/index.html` and `docs/continuation/index.html`, replace every `claude-continuation` with `continuation`, and `/tree/main/claude-continuation` with `/tree/main/continuation`. In the continuation card on `docs/index.html`, replace the description sentence with: "Project memory for any coding agent — decisions, learnings, conventions and handoffs in `.continuation/`, written as you work, read in one hot file every session." Verify with:

Run: `grep -rn "claude-continuation" docs/index.html docs/continuation/ README.md .claude-plugin/ continuation/ | grep -v CHANGELOG | grep -v MIGRATION`
Expected: no output.

- [ ] **Step 4: Gitignore and archive the OpenSpec change**

Append to root `.gitignore`:

```
.continuation/HOT.md
.continuation/INDEX.md
```

```bash
mkdir -p openspec/changes/archive
git mv openspec/changes/add-continuation-standard openspec/changes/archive/2026-09-08-add-continuation-standard
```

Add as the first line under the title of `docs/superpowers/specs/2026-06-21-continuation-standard-design.md`:

```markdown
> **Superseded** on 2026-09-08 by `2026-09-08-continuation-memory-design.md`. Kept for history.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(continuation): marketplace, docs, landing page; archive the superseded CLI spec"
```

---

### Task 17: Dogfood on this repo and the two acceptance fixtures

**Files:** none in this repo beyond what `init`/`migrate` create. Work happens in `~/projects/<client-repo-a>` and `~/projects/<client-repo-b>` on their current branches, uncommitted.

- [ ] **Step 1: Migrate this repo**

Run from the repo root:

```bash
node continuation/scripts/continuation.mjs migrate
node continuation/scripts/continuation.mjs review
```

Expected: 2 sessions and 1 learning migrated; `HOT.md` under 40 lines; review shows no `Invalid`. Commit `.continuation/` (derived files stay ignored):

```bash
git add .continuation .gitignore
git commit -m "chore: migrate session handoffs to .continuation/"
```

- [ ] **Step 2: Migrate <client-repo-a> (largest fixture)**

```bash
node <this-repo>/continuation/scripts/continuation.mjs migrate ~/projects/<client-repo-a>
wc -l ~/projects/<client-repo-a>/.continuation/HOT.md
grep -c "^| 2026" ~/projects/<client-repo-a>/.continuation/INDEX.md
grep -A3 "## Invalid" ~/projects/<client-repo-a>/.continuation/INDEX.md
```

Expected: 88 sessions, learnings + splits ≥ 85, `HOT.md` ≤ 40 lines, no `## Invalid` section. Run migrate a second time and confirm every count is 0.

- [ ] **Step 3: Migrate <client-repo-b>**

Same commands against `~/projects/<client-repo-b>`. Expected: 66 sessions, 22 learnings (some split), no invalid.

- [ ] **Step 4: Acceptance `/continue`**

Open a Claude Code session in `<client-repo-a>` with the plugin installed from this branch (`/plugin marketplace add <this-repo>` then `/plugin install continuation@amjad1233`), run `/continue`. Expected: the orientation names the 2026-09-04 help-domain cutover session, the rule "newest on branch" or "newest overall", and no error. Then `/end` with a short session and confirm the new record lands in `.continuation/sessions/` with `auto: false`.

- [ ] **Step 5: Hand the fixtures back uncommitted**

Do not commit in the two work repos. Report the per-repo counts and leave the commit decision to the user.

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/project-memory
gh pr create --title "feat(continuation): project memory for any coding agent (2.0.0)" --body "Implements docs/superpowers/specs/2026-09-08-continuation-memory-design.md. Plan: docs/superpowers/plans/2026-09-08-continuation-memory.md. Tests: node --test continuation/scripts/test/ (user runs). Migration dogfooded on <client-repo-a> and <client-repo-b>, left uncommitted there."
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §3 naming, commands as slash files | 1, 14 |
| §4 layout, gitignore, filename rules | 3, 5, 8, 16 |
| §5 schema, validation, `auto` field | 2, 5, 15 |
| §6 HOT.md cap and structure, INDEX history + invalid | 6, 7 |
| §7 write path, supersession, one line "Remembered" | 9, 14, 15 |
| §7.1 auto checkpoints, 10-minute guard, 24-hour preference in `/continue` | 10, 14, 15 (hooks) |
| §8 read path, branch-first session resolution | 14, 15, agents-contract (8) |
| §9 review: conflicts, stale, thin, orphans, chains; never delete | 11, 14 |
| §10 portability: contract, skill via skills.sh, helper, Claude hooks | 8, 15 |
| §11 migration incl. split, T000000, idempotent, `--all`, fixtures | 12, 13, 17 |
| §12 concurrency: no author, no shared files | 5 (schema), 16 (gitignore) |
| §13 error handling: missing folder exit 0, invalid skipped, non-git | 4, 5, 7 |
| §14 tests + manual acceptance | every task, 17 |

Gaps closed during review: `/continue`'s 24-hour checkpoint preference lives in the command prose (Task 14) since it needs the model to merge two records; the helper only orders. Stale "branch deleted and merged more than 30 days ago" from §9 is dropped from the helper: it needs remote state and adds a network call; `files missing` covers the common case, and the spec's review list stays advisory.

Type consistency check: `write()` signature (`type, tags, summary, body, files, supersedes, confidence, slug, auto, when`) is used identically in Tasks 9, 10. `loadAll` shape `{ records: {data, body, file, type}[], invalid }` used in 5, 6, 7, 10, 11, 12. `resolveRoot(cwd, positional)` exported from rebuild and consumed by every command.
