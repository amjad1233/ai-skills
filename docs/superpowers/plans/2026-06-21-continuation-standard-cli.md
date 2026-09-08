# Continuation Standard + CLI — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@amjad1233/continuation` npm CLI and the tool-neutral `continuation/` standard it scaffolds, so any AI tool can read/write shared session handoffs.

**Architecture:** A small Node (ESM) CLI in `continuation/` within this monorepo. `init` scaffolds a `continuation/` directory into a target repo (AGENTS.md spec + templates + config), patches each selected tool's config (Claude Code, OpenCode, Antigravity) with thin trigger stubs that delegate to the spec, and gitignores `continuation/agent-army/`. Supporting commands: `validate`, `list`, `archive`, `update`. Canonical workflow prose lives once in `spec/AGENTS.md` (the C-hybrid model).

**Tech Stack:** Node ≥18 (ESM, `"type":"module"`), zero runtime deps, tests via built-in `node:test` + `node:assert`, run with `node --test`.

**Scope of this plan:** The CLI and the standard, with the **continuation artifact type** (sessions + learnings) fully specified. The `claude-continuation` skill rewiring is Plan 2; the `agent-army` rewiring is Plan 3. This plan only *reserves and documents* `continuation/agent-army/`.

**Follow-on plans (not built here):**
- Plan 2 — port `claude-continuation` commands (`/end`, `/continue`, `/next`) off `.claude/continuations` onto `continuation/sessions` + shared templates.
- Plan 3 — port `agent-army` command centre from `~/.claude/agent-army/<op>` to `continuation/agent-army/<op>` with a configurable root.

---

## File structure (created by this plan)

```
continuation/
├── package.json                     # name @amjad1233/continuation, bin: continuation, type: module
├── .gitignore                       # node_modules, *.tgz
├── README.md
├── bin/continuation.js              # shebang entry → imports src/cli.js
├── src/
│   ├── cli.js                       # arg parsing + command dispatch
│   ├── paths.js                     # resolve repo root, continuation/ dir, template dir
│   ├── commands/
│   │   ├── init.js
│   │   ├── validate.js
│   │   ├── list.js
│   │   ├── archive.js
│   │   ├── update.js
│   │   └── migrate.js
│   ├── adapters/
│   │   ├── index.js                 # registry: name → adapter module
│   │   ├── claude.js
│   │   ├── opencode.js
│   │   └── antigravity.js
│   └── lib/
│       ├── fsx.js                   # ensureDir, writeIfAbsent, mergeBlock helpers
│       └── slug.js                  # filename slug + collision suffix
├── spec/AGENTS.md                   # canonical tool-neutral workflow spec (copied on init)
├── templates/
│   ├── session.md
│   ├── learnings.md
│   ├── continuation.config.json
│   └── adapters/
│       ├── claude/{end.md,continue.md}
│       ├── opencode/{end.md,continue.md}
│       └── antigravity/continuation.md
└── test/
    ├── helpers.js                   # makeTempRepo()
    ├── init.test.js
    ├── adapters.test.js
    ├── validate.test.js
    ├── list-archive.test.js
    └── migrate.test.js
```

---

### Task 1: Scaffold the package skeleton

**Files:**
- Create: `continuation/package.json`
- Create: `continuation/.gitignore`
- Create: `continuation/bin/continuation.js`
- Create: `continuation/src/cli.js`

- [ ] **Step 1: Create `continuation/package.json`**

```json
{
  "name": "@amjad1233/continuation",
  "version": "0.1.0",
  "description": "Cross-tool standard + CLI for AI session handoffs, learnings, and agent fleets.",
  "type": "module",
  "bin": { "continuation": "bin/continuation.js" },
  "files": ["bin", "src", "spec", "templates", "README.md"],
  "scripts": { "test": "node --test" },
  "engines": { "node": ">=18" },
  "author": "Amjad <amjad1233>",
  "license": "MIT"
}
```

- [ ] **Step 2: Create `continuation/.gitignore`**

```
node_modules/
*.tgz
```

- [ ] **Step 3: Create the bin entry `continuation/bin/continuation.js`**

```js
#!/usr/bin/env node
import { run } from "../src/cli.js";
run(process.argv.slice(2)).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
```

- [ ] **Step 4: Create a minimal `continuation/src/cli.js` (dispatch stub)**

```js
export async function run(argv) {
  const [cmd] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log("continuation <init|validate|list|archive|update>");
    return;
  }
  throw new Error(`unknown command: ${cmd}`);
}
```

- [ ] **Step 5: Make the bin executable and smoke-test it**

Run:
```bash
cd continuation && chmod +x bin/continuation.js && node bin/continuation.js --help
```
Expected: prints `continuation <init|validate|list|archive|update>`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add continuation/package.json continuation/.gitignore continuation/bin continuation/src/cli.js
git commit -m "feat(continuation): scaffold CLI package skeleton"
```

---

### Task 2: Path + fs + slug helpers (with tests)

**Files:**
- Create: `continuation/src/paths.js`
- Create: `continuation/src/lib/fsx.js`
- Create: `continuation/src/lib/slug.js`
- Create: `continuation/test/helpers.js`
- Test: `continuation/test/slug.test.js`

- [ ] **Step 1: Write the failing test `continuation/test/slug.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileSlug, nextFreeName } from "../src/lib/slug.js";

test("fileSlug lowercases, hyphenates, strips junk, ensures leading letter", () => {
  assert.equal(fileSlug("Stripe Webhook Handler"), "stripe-webhook-handler");
  assert.equal(fileSlug("  Fix: the_test suite!! "), "fix-the-test-suite");
  assert.equal(fileSlug("123 numbers first"), "n-123-numbers-first");
});

test("nextFreeName returns base when free, else -2/-3 suffix", () => {
  const exists = new Set(["2026-06-21-x.md", "2026-06-21-x-2.md"]);
  assert.equal(nextFreeName("2026-06-21-y.md", (n) => exists.has(n)), "2026-06-21-y.md");
  assert.equal(nextFreeName("2026-06-21-x.md", (n) => exists.has(n)), "2026-06-21-x-3.md");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/slug.test.js`
Expected: FAIL — `Cannot find module '../src/lib/slug.js'`.

- [ ] **Step 3: Implement `continuation/src/lib/slug.js`**

```js
export function fileSlug(input) {
  let s = String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) s = "session";
  if (!/^[a-z]/.test(s)) s = "n-" + s;
  return s;
}

export function nextFreeName(filename, exists) {
  if (!exists(filename)) return filename;
  const dot = filename.lastIndexOf(".");
  const base = filename.slice(0, dot);
  const ext = filename.slice(dot);
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!exists(candidate)) return candidate;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd continuation && node --test test/slug.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `continuation/src/lib/fsx.js`**

```js
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function writeIfAbsent(path, content) {
  if (existsSync(path)) return false;
  writeFileSync(path, content);
  return true;
}

// Append a delimited block to a file (creating it if absent), idempotently.
// Returns false if the marker is already present.
export function appendBlockOnce(path, marker, block) {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (existing.includes(marker)) return false;
  const sep = existing && !existing.endsWith("\n") ? "\n" : "";
  writeFileSync(path, existing + sep + block);
  return true;
}
```

- [ ] **Step 6: Implement `continuation/src/paths.js`**

```js
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function packageRoot() {
  return resolve(here, "..");
}

export function templateDir() {
  return resolve(packageRoot(), "templates");
}

export function specPath() {
  return resolve(packageRoot(), "spec", "AGENTS.md");
}

// Repo root of the target project (cwd), falling back to cwd when not a git repo.
export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    return cwd;
  }
}

export function continuationDir(cwd = process.cwd()) {
  return resolve(repoRoot(cwd), "continuation");
}
```

- [ ] **Step 7: Create the test helper `continuation/test/helpers.js`**

```js
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "cont-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}
```

- [ ] **Step 8: Commit**

```bash
git add continuation/src/paths.js continuation/src/lib continuation/test/slug.test.js continuation/test/helpers.js
git commit -m "feat(continuation): path, fs, and slug helpers with tests"
```

---

### Task 3: The canonical spec and templates

**Files:**
- Create: `continuation/spec/AGENTS.md`
- Create: `continuation/templates/session.md`
- Create: `continuation/templates/learnings.md`
- Create: `continuation/templates/continuation.config.json`

- [ ] **Step 1: Create `continuation/spec/AGENTS.md` (the standard)**

````markdown
# Continuation — workflow spec for AI tools

This repo uses the **continuation** standard. Any AI coding tool working here
reads this file to learn how to hand off and resume work across sessions and
across tools. A handoff written by one tool MUST be resumable by another.

## Directory layout

```
continuation/
├── AGENTS.md                 # this file
├── continuation.config.json  # project name, schema version, wired tools
├── sessions/                 # session handoffs (committed)
├── learnings/                # durable, non-obvious learnings (committed)
├── agent-army/               # live agent-fleet command centre (gitignored)
└── archive/                  # rolled-off sessions/learnings (committed)
```

## Filenames

- Every session/learning file is named `YYYY-MM-DDTHHMMSS-<slug>.md`.
- The prefix is a local-time, 24-hour, zero-padded, colon-free timestamp
  (`date +%Y-%m-%dT%H%M%S`, e.g. `2026-06-21T143052`). It makes every handoff
  uniquely identifiable and lexically sortable into chronological order, so the
  latest session is unambiguous even within a single day.
- `<slug>` is 2–4 lowercase hyphenated words, starting with a letter.
- NEVER overwrite an existing file. On collision (rare — only a same-second
  write) append `-2`, `-3`, … to the slug before the extension.

## The `end` action (write a handoff)

When the user ends a session, write `continuation/sessions/YYYY-MM-DDTHHMMSS-<slug>.md`:

```markdown
# {Project} — {Topic}

**Session timestamp:** {YYYY-MM-DDTHH:MM:SS}
**Branch:** {branch, or "—" if non-git}

## What was done this session
- {concrete bullet}

## Current state
- **Working:** {what runs/passes}
- **Not yet:** {what's incomplete}
- **Uncommitted changes:** {git status summary, or "none"}

## Next task
{One unambiguous instruction, specific enough to start without re-asking.}

## Key files
- `path` — why it matters

## Notes
{Optional. Omit the heading if empty.}
```

Optionally also write `continuation/learnings/YYYY-MM-DDTHHMMSS-<slug>.md` — ONLY for
non-obvious material that would trip up a competent developer again:

```markdown
# Learnings — {Topic}

**Session timestamp:** {YYYY-MM-DDTHH:MM:SS}

## {Learning title}
- **What happened:** {situation}
- **Rule:** {actionable pattern}
- **Example:** {optional code/command}
```

Do not lint, commit, or push as part of `end`. Keep handoffs under ~150 lines.

## The `continue` action (resume) — READ-ONLY

1. List `continuation/sessions/*.md`, sort filenames descending; the first is
   newest. Read it fully.
2. In a git repo, compare against live state (`git branch`, `git status`,
   recent `git log`). Mention branch mismatches or newer commits; never
   auto-switch branches.
3. Present a compact orientation (project, last session, branch, current state,
   next task, key files), then hand back to the user. Write nothing.

## The `agent-army` directory (reserved)

`continuation/agent-army/` holds live multi-agent fleet state and is gitignored.
It lives ONLY in the main checkout; agents in git worktrees reference it by
absolute path. Its schema is defined by the agent-army tooling (see Plan 3).
````

- [ ] **Step 2: Create `continuation/templates/session.md`** — the body of the `end` template above (the fenced `# {Project} — {Topic}` block), as a standalone file with the same `{placeholder}` tokens.

```markdown
# {Project} — {Topic}

**Session timestamp:** {YYYY-MM-DDTHH:MM:SS}
**Branch:** {branch}

## What was done this session
- {concrete bullet}

## Current state
- **Working:** {what runs/passes}
- **Not yet:** {what's incomplete}
- **Uncommitted changes:** {git status summary, or "none"}

## Next task
{One unambiguous instruction.}

## Key files
- `path` — why it matters

## Notes
{Optional.}
```

- [ ] **Step 3: Create `continuation/templates/learnings.md`**

```markdown
# Learnings — {Topic}

**Session timestamp:** {YYYY-MM-DDTHH:MM:SS}

## {Learning title}
- **What happened:** {situation}
- **Rule:** {actionable pattern}
- **Example:** {optional code/command}
```

- [ ] **Step 4: Create `continuation/templates/continuation.config.json`** (template with tokens replaced on init)

```json
{
  "schemaVersion": 1,
  "project": "{PROJECT}",
  "tools": []
}
```

- [ ] **Step 5: Commit**

```bash
git add continuation/spec continuation/templates/session.md continuation/templates/learnings.md continuation/templates/continuation.config.json
git commit -m "feat(continuation): canonical AGENTS.md spec and artifact templates"
```

---

### Task 4: `init` — scaffold the `continuation/` directory (no tool patching yet)

**Files:**
- Create: `continuation/src/commands/init.js`
- Modify: `continuation/src/cli.js`
- Test: `continuation/test/init.test.js`

- [ ] **Step 1: Write the failing test `continuation/test/init.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./helpers.js";
import { init } from "../src/commands/init.js";

test("init scaffolds the continuation/ tree and config", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });

  const base = join(repo, "continuation");
  for (const d of ["sessions", "learnings", "archive", "agent-army"]) {
    assert.ok(existsSync(join(base, d)), `${d}/ should exist`);
  }
  assert.ok(existsSync(join(base, "AGENTS.md")), "AGENTS.md copied");

  const cfg = JSON.parse(readFileSync(join(base, "continuation.config.json"), "utf8"));
  assert.equal(cfg.schemaVersion, 1);
  assert.equal(typeof cfg.project, "string");
  assert.notEqual(cfg.project, "{PROJECT}");

  const gi = readFileSync(join(repo, ".gitignore"), "utf8");
  assert.match(gi, /continuation\/agent-army\//);
});

test("init is idempotent — second run does not duplicate gitignore rule", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  await init({ cwd: repo, tools: [] });
  const gi = readFileSync(join(repo, ".gitignore"), "utf8");
  const count = (gi.match(/continuation\/agent-army\//g) || []).length;
  assert.equal(count, 1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/init.test.js`
Expected: FAIL — `Cannot find module '../src/commands/init.js'`.

- [ ] **Step 3: Implement `continuation/src/commands/init.js`**

```js
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureDir, writeIfAbsent, appendBlockOnce } from "../lib/fsx.js";
import { repoRoot, continuationDir, templateDir, specPath } from "../paths.js";
import { applyAdapters } from "../adapters/index.js";

export async function init({ cwd = process.cwd(), tools = [] } = {}) {
  const root = repoRoot(cwd);
  const base = continuationDir(cwd);

  for (const d of ["sessions", "learnings", "archive", "agent-army"]) {
    ensureDir(join(base, d));
  }

  copyFileSync(specPath(), join(base, "AGENTS.md"));

  const cfgTpl = readFileSync(join(templateDir(), "continuation.config.json"), "utf8");
  const cfg = JSON.parse(cfgTpl.replace("{PROJECT}", basename(root)));
  cfg.tools = tools;
  writeIfAbsent(join(base, "continuation.config.json"), JSON.stringify(cfg, null, 2) + "\n");

  appendBlockOnce(
    join(root, ".gitignore"),
    "continuation/agent-army/",
    "# continuation: live agent-fleet state (main checkout only)\ncontinuation/agent-army/\n"
  );

  const wired = applyAdapters(tools, { root });

  return { base, tools: wired };
}
```

- [ ] **Step 4: Create a no-op adapter registry so `init` imports cleanly `continuation/src/adapters/index.js`**

```js
export function applyAdapters(/* tools, ctx */) {
  return []; // real adapters land in Task 6
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd continuation && node --test test/init.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire `init` into the dispatcher — replace `continuation/src/cli.js`**

```js
import { init } from "./commands/init.js";

const TOOL_ALIASES = ["claude", "opencode", "antigravity"];

function parseTools(argv) {
  const flag = argv.find((a) => a.startsWith("--tools="));
  if (!flag) return TOOL_ALIASES; // default: wire all supported tools
  return flag
    .slice("--tools=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function run(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "init": {
      const { base, tools } = await init({ tools: parseTools(rest) });
      console.log(`continuation/ ready at ${base}`);
      console.log(`tools wired: ${tools.length ? tools.join(", ") : "none"}`);
      return;
    }
    case undefined:
    case "--help":
    case "-h":
      console.log("continuation <init|validate|list|archive|update>");
      return;
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
}
```

- [ ] **Step 7: End-to-end smoke test**

Run:
```bash
cd /tmp && rm -rf cont-smoke && mkdir cont-smoke && cd cont-smoke && git init -q
node /Users/you/projects/ai-skills/continuation/bin/continuation.js init --tools=
ls continuation && cat continuation/continuation.config.json
```
Expected: `AGENTS.md  agent-army  archive  continuation.config.json  learnings  sessions`, and config `project` = `cont-smoke`.

- [ ] **Step 8: Commit**

```bash
git add continuation/src/commands/init.js continuation/src/adapters/index.js continuation/src/cli.js continuation/test/init.test.js
git commit -m "feat(continuation): init scaffolds the continuation/ directory"
```

---

### Task 5: Adapter trigger-stub templates

**Files:**
- Create: `continuation/templates/adapters/claude/end.md`
- Create: `continuation/templates/adapters/claude/continue.md`
- Create: `continuation/templates/adapters/opencode/end.md`
- Create: `continuation/templates/adapters/opencode/continue.md`
- Create: `continuation/templates/adapters/antigravity/continuation.md`

- [ ] **Step 1: Create `continuation/templates/adapters/claude/end.md`**

```markdown
---
description: Write a session handoff using the continuation standard.
---

Follow the **`end` action** defined in `continuation/AGENTS.md`. Write the
handoff to `continuation/sessions/` (and a learnings file to
`continuation/learnings/` only if warranted), using the filename and
collision rules in that spec. Do not lint, commit, or push.
```

- [ ] **Step 2: Create `continuation/templates/adapters/claude/continue.md`**

```markdown
---
description: Resume from the latest session handoff (read-only).
---

Follow the **`continue` action** defined in `continuation/AGENTS.md`: read the
newest file in `continuation/sessions/`, reality-check git state, present a
compact orientation, and hand back to the user. Write nothing.
```

- [ ] **Step 3: Create `continuation/templates/adapters/opencode/end.md` and `continue.md`** — identical body text to the two Claude stubs above (same delegating instruction), without the YAML frontmatter (OpenCode command files are plain markdown). Copy the body paragraphs verbatim.

`end.md`:
```markdown
Follow the **`end` action** defined in `continuation/AGENTS.md`. Write the
handoff to `continuation/sessions/` (and a learnings file to
`continuation/learnings/` only if warranted), using the filename and
collision rules in that spec. Do not lint, commit, or push.
```

`continue.md`:
```markdown
Follow the **`continue` action** defined in `continuation/AGENTS.md`: read the
newest file in `continuation/sessions/`, reality-check git state, present a
compact orientation, and hand back to the user. Write nothing.
```

- [ ] **Step 4: Create `continuation/templates/adapters/antigravity/continuation.md`**

```markdown
# Continuation workflow

This project uses the continuation standard. The full workflow is defined in
`continuation/AGENTS.md`. To end a session, perform its `end` action; to resume,
perform its `continue` action. Session handoffs live in `continuation/sessions/`.
```

- [ ] **Step 5: Commit**

```bash
git add continuation/templates/adapters
git commit -m "feat(continuation): per-tool trigger-stub templates"
```

---

### Task 6: Adapters — patch each tool's config on `init`

**Files:**
- Create: `continuation/src/adapters/claude.js`
- Create: `continuation/src/adapters/opencode.js`
- Create: `continuation/src/adapters/antigravity.js`
- Modify: `continuation/src/adapters/index.js`
- Test: `continuation/test/adapters.test.js`

- [ ] **Step 1: Write the failing test `continuation/test/adapters.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./helpers.js";
import { init } from "../src/commands/init.js";

test("claude adapter imports the spec into CLAUDE.md and drops command stubs", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: ["claude"] });

  const claudeMd = readFileSync(join(repo, "CLAUDE.md"), "utf8");
  assert.match(claudeMd, /@continuation\/AGENTS\.md/);
  assert.ok(existsSync(join(repo, ".claude", "commands", "end.md")));
  assert.ok(existsSync(join(repo, ".claude", "commands", "continue.md")));
});

test("opencode + antigravity adapters reference the spec via AGENTS.md", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: ["opencode", "antigravity"] });

  const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");
  assert.match(agents, /continuation\/AGENTS\.md/);
  assert.ok(existsSync(join(repo, ".opencode", "command", "end.md")));
  assert.ok(existsSync(join(repo, ".antigravity", "continuation.md")));
});

test("adapter patching is idempotent", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: ["claude"] });
  await init({ cwd: repo, tools: ["claude"] });
  const claudeMd = readFileSync(join(repo, "CLAUDE.md"), "utf8");
  const count = (claudeMd.match(/@continuation\/AGENTS\.md/g) || []).length;
  assert.equal(count, 1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/adapters.test.js`
Expected: FAIL — CLAUDE.md not created (registry is still the no-op stub).

- [ ] **Step 3: Implement `continuation/src/adapters/claude.js`**

```js
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, appendBlockOnce } from "../lib/fsx.js";
import { templateDir } from "../paths.js";

export const name = "claude";

export function apply({ root }) {
  appendBlockOnce(
    join(root, "CLAUDE.md"),
    "@continuation/AGENTS.md",
    "## Continuation\n\nThis project uses the continuation standard. @continuation/AGENTS.md\n"
  );
  const cmdDir = join(root, ".claude", "commands");
  ensureDir(cmdDir);
  const src = join(templateDir(), "adapters", "claude");
  for (const f of ["end.md", "continue.md"]) {
    copyFileSync(join(src, f), join(cmdDir, f));
  }
  return name;
}
```

- [ ] **Step 4: Implement `continuation/src/adapters/opencode.js`**

```js
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, appendBlockOnce } from "../lib/fsx.js";
import { templateDir } from "../paths.js";

export const name = "opencode";

export function apply({ root }) {
  appendBlockOnce(
    join(root, "AGENTS.md"),
    "continuation/AGENTS.md",
    "## Continuation\n\nSession handoffs follow `continuation/AGENTS.md`. Read it for the `end` and `continue` actions.\n"
  );
  const cmdDir = join(root, ".opencode", "command");
  ensureDir(cmdDir);
  const src = join(templateDir(), "adapters", "opencode");
  for (const f of ["end.md", "continue.md"]) {
    copyFileSync(join(src, f), join(cmdDir, f));
  }
  return name;
}
```

- [ ] **Step 5: Implement `continuation/src/adapters/antigravity.js`**

```js
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, appendBlockOnce } from "../lib/fsx.js";
import { templateDir } from "../paths.js";

export const name = "antigravity";

export function apply({ root }) {
  // Antigravity reads root AGENTS.md too; ensure the pointer is present.
  appendBlockOnce(
    join(root, "AGENTS.md"),
    "continuation/AGENTS.md",
    "## Continuation\n\nSession handoffs follow `continuation/AGENTS.md`. Read it for the `end` and `continue` actions.\n"
  );
  const dir = join(root, ".antigravity");
  ensureDir(dir);
  copyFileSync(
    join(templateDir(), "adapters", "antigravity", "continuation.md"),
    join(dir, "continuation.md")
  );
  return name;
}
```

- [ ] **Step 6: Replace the registry `continuation/src/adapters/index.js`**

```js
import * as claude from "./claude.js";
import * as opencode from "./opencode.js";
import * as antigravity from "./antigravity.js";

const REGISTRY = { claude, opencode, antigravity };

export function applyAdapters(tools, ctx) {
  const wired = [];
  for (const t of tools) {
    const adapter = REGISTRY[t];
    if (!adapter) {
      console.warn(`skipping unknown tool: ${t}`);
      continue;
    }
    wired.push(adapter.apply(ctx));
  }
  return wired;
}
```

- [ ] **Step 7: Run the adapter tests to verify they pass**

Run: `cd continuation && node --test test/adapters.test.js`
Expected: PASS (3 tests).

Note: the `opencode + antigravity` test asserts a single `## Continuation` pointer in `AGENTS.md`; because both adapters share the `continuation/AGENTS.md` marker, `appendBlockOnce` writes it once — that is intended.

- [ ] **Step 8: Run the full suite**

Run: `cd continuation && node --test`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add continuation/src/adapters continuation/test/adapters.test.js
git commit -m "feat(continuation): claude/opencode/antigravity init adapters"
```

---

### Task 7: `validate` — lint a continuation/ directory

**Files:**
- Create: `continuation/src/commands/validate.js`
- Modify: `continuation/src/cli.js`
- Test: `continuation/test/validate.test.js`

- [ ] **Step 1: Write the failing test `continuation/test/validate.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { validate } from "../src/commands/validate.js";

test("validate passes on a fresh init", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  const { ok, errors } = await validate({ cwd: repo });
  assert.equal(ok, true);
  assert.deepEqual(errors, []);
});

test("validate flags a misnamed session file", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  writeFileSync(join(repo, "continuation", "sessions", "notadate.md"), "# x\n");
  const { ok, errors } = await validate({ cwd: repo });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("notadate.md")));
});

test("validate fails when continuation/ is missing", async () => {
  const repo = makeTempRepo();
  const { ok, errors } = await validate({ cwd: repo });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("not initialised")));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/validate.test.js`
Expected: FAIL — `Cannot find module '../src/commands/validate.js'`.

- [ ] **Step 3: Implement `continuation/src/commands/validate.js`**

```js
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { continuationDir } from "../paths.js";

const NAME_RE = /^\d{4}-\d{2}-\d{2}T\d{6}-[a-z][a-z0-9-]*\.md$/;

export async function validate({ cwd = process.cwd() } = {}) {
  const base = continuationDir(cwd);
  const errors = [];

  if (!existsSync(base) || !existsSync(join(base, "AGENTS.md"))) {
    errors.push("continuation/ is not initialised (run `continuation init`)");
    return { ok: false, errors };
  }

  for (const sub of ["sessions", "learnings"]) {
    const dir = join(base, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      if (!NAME_RE.test(f)) {
        errors.push(`${sub}/${f}: bad filename (want YYYY-MM-DDTHHMMSS-<slug>.md)`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd continuation && node --test test/validate.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire `validate` into `continuation/src/cli.js`** — add the import and case.

Add near the other import:
```js
import { validate } from "./commands/validate.js";
```
Add this case inside the `switch`, before `default`:
```js
    case "validate": {
      const { ok, errors } = await validate({});
      if (ok) {
        console.log("continuation: OK");
      } else {
        for (const e of errors) console.error(`  ✗ ${e}`);
        process.exitCode = 1;
      }
      return;
    }
```

- [ ] **Step 6: Commit**

```bash
git add continuation/src/commands/validate.js continuation/src/cli.js continuation/test/validate.test.js
git commit -m "feat(continuation): validate command lints the continuation/ dir"
```

---

### Task 8: `list` and `archive`

**Files:**
- Create: `continuation/src/commands/list.js`
- Create: `continuation/src/commands/archive.js`
- Modify: `continuation/src/cli.js`
- Test: `continuation/test/list-archive.test.js`

- [ ] **Step 1: Write the failing test `continuation/test/list-archive.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { listSessions } from "../src/commands/list.js";
import { archive } from "../src/commands/archive.js";

test("listSessions returns newest first", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  const s = join(repo, "continuation", "sessions");
  writeFileSync(join(s, "2026-06-20-a.md"), "# a\n");
  writeFileSync(join(s, "2026-06-21-b.md"), "# b\n");
  const items = listSessions({ cwd: repo });
  assert.deepEqual(items, ["2026-06-21-b.md", "2026-06-20-a.md"]);
});

test("archive moves a session into archive/", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  const s = join(repo, "continuation", "sessions");
  writeFileSync(join(s, "2026-06-20-a.md"), "# a\n");
  archive({ cwd: repo, file: "2026-06-20-a.md" });
  assert.ok(!existsSync(join(s, "2026-06-20-a.md")));
  assert.ok(existsSync(join(repo, "continuation", "archive", "2026-06-20-a.md")));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/list-archive.test.js`
Expected: FAIL — `Cannot find module '../src/commands/list.js'`.

- [ ] **Step 3: Implement `continuation/src/commands/list.js`**

```js
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { continuationDir } from "../paths.js";

export function listSessions({ cwd = process.cwd() } = {}) {
  const dir = join(continuationDir(cwd), "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();
}
```

- [ ] **Step 4: Implement `continuation/src/commands/archive.js`**

```js
import { renameSync } from "node:fs";
import { join } from "node:path";
import { ensureDir } from "../lib/fsx.js";
import { continuationDir } from "../paths.js";

export function archive({ cwd = process.cwd(), file } = {}) {
  if (!file) throw new Error("archive: a filename is required");
  const base = continuationDir(cwd);
  const dest = join(base, "archive");
  ensureDir(dest);
  // Look in sessions/ then learnings/.
  for (const sub of ["sessions", "learnings"]) {
    const from = join(base, sub, file);
    try {
      renameSync(from, join(dest, file));
      return { moved: `${sub}/${file}` };
    } catch {
      // try next subdir
    }
  }
  throw new Error(`archive: ${file} not found in sessions/ or learnings/`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd continuation && node --test test/list-archive.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire both into `continuation/src/cli.js`** — add imports and cases.

Add imports:
```js
import { listSessions } from "./commands/list.js";
import { archive } from "./commands/archive.js";
```
Add cases before `default`:
```js
    case "list": {
      const items = listSessions({});
      if (!items.length) console.log("no sessions yet");
      else for (const f of items) console.log(f);
      return;
    }
    case "archive": {
      const { moved } = archive({ file: rest[0] });
      console.log(`archived ${moved}`);
      return;
    }
```

- [ ] **Step 7: Commit**

```bash
git add continuation/src/commands/list.js continuation/src/commands/archive.js continuation/src/cli.js continuation/test/list-archive.test.js
git commit -m "feat(continuation): list and archive commands"
```

---

### Task 9: `update` — re-sync spec + stubs after a schema bump

**Files:**
- Create: `continuation/src/commands/update.js`
- Modify: `continuation/src/cli.js`
- Test: `continuation/test/update.test.js`

- [ ] **Step 1: Write the failing test `continuation/test/update.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { update } from "../src/commands/update.js";

test("update rewrites AGENTS.md from the shipped spec and re-applies wired tools", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: ["claude"] });

  // Simulate local drift in the copied spec.
  const specCopy = join(repo, "continuation", "AGENTS.md");
  writeFileSync(specCopy, "stale\n");

  await update({ cwd: repo });

  const refreshed = readFileSync(specCopy, "utf8");
  assert.match(refreshed, /Continuation — workflow spec/);
  // Wired tool (claude) re-applied from config.
  assert.match(readFileSync(join(repo, "CLAUDE.md"), "utf8"), /@continuation\/AGENTS\.md/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/update.test.js`
Expected: FAIL — `Cannot find module '../src/commands/update.js'`.

- [ ] **Step 3: Implement `continuation/src/commands/update.js`**

```js
import { copyFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, continuationDir, specPath } from "../paths.js";
import { applyAdapters } from "../adapters/index.js";

export async function update({ cwd = process.cwd() } = {}) {
  const base = continuationDir(cwd);
  const cfgPath = join(base, "continuation.config.json");
  if (!existsSync(cfgPath)) {
    throw new Error("update: continuation/ is not initialised");
  }
  // Refresh the canonical spec copy.
  copyFileSync(specPath(), join(base, "AGENTS.md"));

  // Re-apply adapters for the tools recorded in config.
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const wired = applyAdapters(cfg.tools || [], { root: repoRoot(cwd) });
  return { tools: wired };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd continuation && node --test test/update.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Wire `update` into `continuation/src/cli.js`**

Add import:
```js
import { update } from "./commands/update.js";
```
Add case before `default`:
```js
    case "update": {
      const { tools } = await update({});
      console.log(`continuation updated (tools: ${tools.join(", ") || "none"})`);
      return;
    }
```

- [ ] **Step 6: Run the full suite**

Run: `cd continuation && node --test`
Expected: all test files PASS.

- [ ] **Step 7: Commit**

```bash
git add continuation/src/commands/update.js continuation/src/cli.js continuation/test/update.test.js
git commit -m "feat(continuation): update command re-syncs spec and adapters"
```

---

### Task 10: `migrate` — copy legacy `.claude/` artifacts into the standard

**Files:**
- Create: `continuation/src/commands/migrate.js`
- Modify: `continuation/src/cli.js`
- Test: `continuation/test/migrate.test.js`

Copy-only, idempotent bridge for repos already on the Claude-native skills. Never
deletes a source. Re-running is a no-op (skips byte-identical destinations); a
name clash with differing content gets the standard `-2`/`-3` suffix. Sources:
`.claude/continuations/*.md` → `continuation/sessions/`, `.claude/learnings/*.md`
→ `continuation/learnings/`, and each `<op>` under the agent-army source (default
`$HOME/.claude/agent-army`, override with `--agent-army-src`) →
`continuation/agent-army/<op>/`.

- [ ] **Step 1: Write the failing test `continuation/test/migrate.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { migrate } from "../src/commands/migrate.js";

function seedLegacy(repo) {
  mkdirSync(join(repo, ".claude", "continuations"), { recursive: true });
  mkdirSync(join(repo, ".claude", "learnings"), { recursive: true });
  writeFileSync(join(repo, ".claude", "continuations", "2026-06-20-a.md"), "# a\n");
  writeFileSync(join(repo, ".claude", "learnings", "2026-06-20-l.md"), "# l\n");
}

test("migrate copies sessions, learnings, and agent-army; leaves sources", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  seedLegacy(repo);
  const aa = join(repo, "fake-home", ".claude", "agent-army", "op1");
  mkdirSync(aa, { recursive: true });
  writeFileSync(join(aa, "command-centre.md"), "# cc\n");

  const res = migrate({ cwd: repo, agentArmySrc: join(repo, "fake-home", ".claude", "agent-army") });

  const C = join(repo, "continuation");
  assert.ok(existsSync(join(C, "sessions", "2026-06-20-a.md")));
  assert.ok(existsSync(join(C, "learnings", "2026-06-20-l.md")));
  assert.ok(existsSync(join(C, "agent-army", "op1", "command-centre.md")));
  // Sources untouched.
  assert.ok(existsSync(join(repo, ".claude", "continuations", "2026-06-20-a.md")));
  assert.equal(res.copied, 3);
});

test("migrate is idempotent — second run copies nothing", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  seedLegacy(repo);
  migrate({ cwd: repo, agentArmySrc: join(repo, "none") });
  const res = migrate({ cwd: repo, agentArmySrc: join(repo, "none") });
  assert.equal(res.copied, 0);
  assert.equal(res.skipped, 2);
});

test("migrate suffixes a name clash with differing content", async () => {
  const repo = makeTempRepo();
  await init({ cwd: repo, tools: [] });
  seedLegacy(repo);
  // Pre-existing destination with DIFFERENT content.
  writeFileSync(join(repo, "continuation", "sessions", "2026-06-20-a.md"), "# different\n");
  const res = migrate({ cwd: repo, agentArmySrc: join(repo, "none") });
  assert.equal(res.renamed, 1);
  assert.ok(existsSync(join(repo, "continuation", "sessions", "2026-06-20-a-2.md")));
});

test("migrate requires continuation/ to exist", () => {
  const repo = makeTempRepo();
  assert.throws(() => migrate({ cwd: repo }), /not initialised/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd continuation && node --test test/migrate.test.js`
Expected: FAIL — `Cannot find module '../src/commands/migrate.js'`.

- [ ] **Step 3: Implement `continuation/src/commands/migrate.js`**

```js
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import { repoRoot, continuationDir } from "../paths.js";
import { ensureDir } from "../lib/fsx.js";
import { nextFreeName } from "../lib/slug.js";

// Copy one file unless an identical copy already sits at dest; on a differing
// name clash, fall back to the -2/-3 suffix. Returns "copied" | "skipped" | "renamed".
function copyFile(src, destDir, name, dryRun) {
  ensureDir(destDir);
  const body = readFileSync(src);
  const target = join(destDir, name);
  if (existsSync(target)) {
    if (readFileSync(target).equals(body)) return "skipped";
    const free = nextFreeName(name, (n) => existsSync(join(destDir, n)));
    if (!dryRun) writeFileSync(join(destDir, free), body);
    return "renamed";
  }
  if (!dryRun) writeFileSync(target, body);
  return "copied";
}

// Recursively walk a directory yielding [absPath, relPath] for every file.
function* walk(dir, root = dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) yield* walk(abs, root);
    else yield [abs, relative(root, abs)];
  }
}

export function migrate({
  cwd = process.cwd(),
  dryRun = false,
  agentArmySrc = join(homedir(), ".claude", "agent-army"),
} = {}) {
  const root = repoRoot(cwd);
  const base = continuationDir(cwd);
  if (!existsSync(join(base, "continuation.config.json"))) {
    throw new Error("migrate: continuation/ is not initialised — run `init` first");
  }

  const tally = { copied: 0, skipped: 0, renamed: 0 };
  const bump = (r) => tally[r]++;

  // Flat .md dirs: sessions + learnings.
  const flat = [
    [join(root, ".claude", "continuations"), join(base, "sessions")],
    [join(root, ".claude", "learnings"), join(base, "learnings")],
  ];
  for (const [from, to] of flat) {
    if (!existsSync(from)) continue;
    for (const f of readdirSync(from)) {
      if (!f.endsWith(".md")) continue;
      bump(copyFile(join(from, f), to, f, dryRun));
    }
  }

  // agent-army: copy every <op> tree, preserving subpaths.
  if (existsSync(agentArmySrc)) {
    for (const op of readdirSync(agentArmySrc)) {
      const opDir = join(agentArmySrc, op);
      if (!statSync(opDir).isDirectory()) continue;
      for (const [abs, rel] of walk(opDir)) {
        const destDir = join(base, "agent-army", op, rel.split("/").slice(0, -1).join("/"));
        bump(copyFile(abs, destDir, rel.split("/").pop(), dryRun));
      }
    }
  }

  return tally;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd continuation && node --test test/migrate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire `migrate` into `continuation/src/cli.js`**

Add import:
```js
import { migrate } from "./commands/migrate.js";
```
Add case before `default` (parse `--dry-run` and `--agent-army-src=` from `rest`):
```js
    case "migrate": {
      const dryRun = rest.includes("--dry-run");
      const srcArg = rest.find((a) => a.startsWith("--agent-army-src="));
      const opts = { dryRun };
      if (srcArg) opts.agentArmySrc = srcArg.split("=").slice(1).join("=");
      const t = migrate(opts);
      const verb = dryRun ? "would copy" : "copied";
      console.log(`${verb} ${t.copied}, skipped ${t.skipped} (identical), renamed ${t.renamed} (collision)`);
      if (!dryRun && (t.copied || t.renamed)) {
        console.log("legacy sources left in place — delete .claude/continuations, .claude/learnings, ~/.claude/agent-army once verified");
      }
      return;
    }
```

- [ ] **Step 6: Run the full suite**

Run: `cd continuation && node --test`
Expected: all test files PASS.

- [ ] **Step 7: Commit**

```bash
git add continuation/src/commands/migrate.js continuation/src/cli.js continuation/test/migrate.test.js
git commit -m "feat(continuation): migrate command copies legacy .claude artifacts"
```

---

### Task 11: README + monorepo wiring

**Files:**
- Create: `continuation/README.md`
- Modify: `README.md` (repo root — add a row/section)

- [ ] **Step 1: Create `continuation/README.md`**

````markdown
# @amjad1233/continuation

A tool-neutral standard + thin CLI for AI session handoffs, learnings, and
agent fleets. Run it once in a repo and any AI tool — Claude Code, OpenCode,
Antigravity — reads the same `continuation/` directory.

## Use

```bash
npx @amjad1233/continuation init           # wire all supported tools
npx @amjad1233/continuation init --tools=claude,opencode
npx @amjad1233/continuation validate
npx @amjad1233/continuation list
npx @amjad1233/continuation archive 2026-06-21-topic.md
npx @amjad1233/continuation update         # after upgrading the package
npx @amjad1233/continuation migrate        # copy legacy .claude/ handoffs in (non-destructive)
```

`init` creates `continuation/` (spec + `sessions/`, `learnings/`, `archive/`,
gitignored `agent-army/`), patches each tool's config, and gitignores the live
fleet directory. The canonical workflow lives in `continuation/AGENTS.md`.

## Develop

```bash
cd continuation && node --test
```
````

- [ ] **Step 2: Add a section to the root `README.md`** — under the Skills table or a new "Standards" subsection, add:

```markdown
## Standards

| Package | What it does |
|---|---|
| [**continuation**](continuation/) | Cross-tool standard + `npx @amjad1233/continuation` CLI. Scaffolds a `continuation/` directory any AI tool (Claude Code, OpenCode, Antigravity) reads for session handoffs, learnings, and agent-fleet state. |
```

- [ ] **Step 3: Verify the CLI is invokable as a package bin**

Run:
```bash
cd continuation && npm pack --dry-run
```
Expected: lists `bin/`, `src/`, `spec/`, `templates/`, `README.md` in the tarball; no errors.

- [ ] **Step 4: Commit**

```bash
git add continuation/README.md README.md
git commit -m "docs(continuation): package README and monorepo wiring"
```

---

## Self-review notes

- **Spec coverage:** root dir contract (Task 3 + Task 4), config (Task 4),
  C-hybrid stubs (Tasks 5–6), three target tools (Task 6), CLI surface
  init/list/archive/validate/update/migrate (Tasks 4, 7, 8, 9, 10), gitignored
  agent-army/ reserved + documented (Tasks 3, 4), legacy `.claude/` migration
  bridge (Task 10), automated tests for each (Tasks 2–10). The cross-tool
  round-trip acceptance test is a manual step — see below.
- **Deferred to follow-on plans:** skill rewiring (Plans 2 & 3). No code here
  touches `claude-continuation/` or `agent-army/` skill files.

## Manual acceptance test (run after Task 11)

In a throwaway repo, `npx @amjad1233/continuation init`, then: with Claude Code,
run `/end` to write a session; open the same repo in OpenCode and confirm its
continue stub reads that session; repeat with Antigravity. A handoff written by
one tool and resumed by another = pass.
````
