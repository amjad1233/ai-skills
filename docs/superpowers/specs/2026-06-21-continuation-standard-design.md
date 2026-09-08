# Continuation — a cross-tool standard for session handoffs & agent fleets

> **Superseded** on 2026-09-08 by `2026-09-08-continuation-memory-design.md`. Kept for history.

**Date:** 2026-06-21
**Author:** Amjad (amjad1233)
**Status:** Approved design, ready for implementation plan

## Problem

The two skills in this monorepo (`agent-army`, `claude-continuation`) are
Claude-Code-native. Their artifacts and instructions are locked to Claude's
plugin format and to `.claude/` paths, so OpenCode, Antigravity, and other
agentic tools can't participate. We want OpenSpec's portability model: a
tool-neutral directory of artifacts at the repo root plus a single spec any
agent reads, wired up by a thin CLI.

## Goal

Define **`continuation`** — a standard + thin `npx` CLI — so that any AI tool
working in a repo can read and write the same session handoffs, learnings, and
agent-army command centre. A handoff written by one tool must be resumable by
another. That cross-tool round-trip is the acceptance criterion.

## Naming (fixed)

- Standard / CLI / root directory: **`continuation`**.
- npm package: **`@amjad1233/continuation`**; CLI bin: `continuation`;
  `author` = Amjad (amjad1233).
- Existing skill names are unchanged: **`agent-army`** and
  **`claude-continuation`** stay exactly as they are. `claude-continuation`
  becomes the Claude adapter onto the standard.

## Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Scope | One shared standard the whole repo adopts; port both skills onto it. |
| Distribution mechanism | Thin `npx` CLI scaffolder (OpenSpec model). |
| Instruction-sync architecture | **C — Hybrid:** canonical prose lives once in `continuation/AGENTS.md`; CLI generates only small native trigger stubs per tool. |
| v1 target tools | Claude Code, OpenCode, Antigravity. (AGENTS.md is the shared spine the latter two read natively.) |
| agent-army command centre | Moves into `continuation/agent-army/`, gitignored, main-checkout only; worktree agents reference it by absolute path. |
| Home | New `continuation/` package in this monorepo (not a separate repo). |

## Architecture

### The `continuation/` contract (in a consumer repo)

```
continuation/
├── AGENTS.md                 # canonical tool-neutral workflow spec (source of truth)
├── continuation.config.json  # tools wired, schema version, project name
├── sessions/                 # session handoffs   (was .claude/continuations/)
│   └── 2026-06-21T143052-topic.md
├── learnings/                # durable learnings  (was .claude/learnings/)
│   └── 2026-06-21T143052-topic.md
├── agent-army/               # command centre (gitignored, main checkout only)
│   ├── command-centre.md
│   └── agents/<id>/{agent-status.md, agent-brief.md}
└── archive/                  # completed sessions/learnings rolled off
```

- **Committed:** `AGENTS.md`, `continuation.config.json`, `sessions/`,
  `learnings/`, `archive/` — the durable, shareable record.
- **Gitignored:** `agent-army/` — live fleet state, main-checkout only.
- `sessions/` is the renamed `continuations/` subdir (avoids stuttering against
  the parent `continuation/`).

### Data flow

Every tool reads `continuation/AGENTS.md`, which specifies: where artifacts
live, the filename convention `YYYY-MM-DDTHHMMSS-slug.md` (local-time, colon-free
timestamp prefix so every handoff is uniquely identifiable and lexically
sortable into chronological order), the collision rule (`-2`, `-3` suffix, never
overwrite — a same-second backstop), and the section schema for each artifact
type. `/end`-equivalent in any tool writes a `sessions/` file that the
`/continue`-equivalent in any other tool reads. The format is now *specified in
the spec* rather than buried inside a Claude command.

### agent-army collision avoidance

The command centre was originally external to the repo so parallel worktree
agents wouldn't collide on it and it would survive branch switches. Under the
standard it lives at `continuation/agent-army/` in the **main** checkout only,
gitignored. Worktree agents do not get their own copy; the master session
passes them the **absolute path** to the main checkout's `continuation/agent-army/`,
preserving the single-shared-location property. The launch/status scripts
already thread paths, so this is a path change, not a model change.

## Monorepo layout (source of truth here)

```
claude-skills/
├── continuation/                    # NEW — standard + CLI (npm: @amjad1233/continuation)
│   ├── package.json                 # author: Amjad <amjad1233>, bin: continuation
│   ├── bin/continuation.js          # CLI entry
│   ├── src/                         # init, list, archive, validate, update
│   ├── spec/AGENTS.md               # canonical workflow spec (copied on init)
│   └── templates/
│       ├── session.md
│       ├── learnings.md
│       ├── command-centre.md
│       ├── agent-brief.md
│       ├── agent-status.md
│       └── adapters/
│           ├── claude/              # slash-command stubs
│           ├── opencode/            # command stubs
│           └── antigravity/         # config stubs
├── agent-army/                      # rewired to write into continuation/agent-army/
└── claude-continuation/             # becomes the Claude adapter onto the standard
```

`templates/` is the **single source of truth** consumed by the CLI *and* by
both existing skills — one definition of a "session" file, not three.

## CLI surface

| Command | Behaviour |
|---|---|
| `continuation init` | Scaffold `continuation/`, copy `AGENTS.md` + templates, patch each selected tool's config, add `.gitignore` rule for `continuation/agent-army/`. Idempotent. |
| `continuation list` | List sessions/learnings newest-first; flag unarchived. |
| `continuation archive <file>` | Move a session/learning into `archive/`. |
| `continuation validate` | Lint the dir: filename convention, required sections, broken refs, overwrite collisions. Compliance self-check. |
| `continuation update` | Re-sync `AGENTS.md` + trigger stubs after a schema-version bump. |
| `continuation migrate` | One-shot bridge for repos already on the Claude-native skills: **copy** legacy artifacts into the standard layout, never deleting the originals. |

Implementation: Node (so `npx` works directly), zero/near-zero runtime deps,
tests via `node:test`.

### `migrate` — legacy adoption bridge

Existing installs keep handoffs in `.claude/continuations/` and `.claude/learnings/`,
and the agent-army command centre in `~/.claude/agent-army/<op>/`. After `init`
scaffolds `continuation/`, those dirs are still where the old skills wrote, so a
post-upgrade `/continue` would read an empty `continuation/sessions/` and look
like history was lost. `migrate` closes that gap.

- **Copy, never move.** Sources are left untouched; the user deletes them by hand
  once satisfied. This is the locked safety property — a botched migrate cannot
  destroy history.
- **Applies immediately** (copy-only, so it's safe). `--dry-run` previews instead.
- **Idempotent:** before copying, if the destination already holds byte-identical
  content, skip it. Re-running is a no-op, not a duplicator.
- **Collision rule:** if a destination filename exists with *differing* content,
  append the standard `-2`/`-3` suffix (same rule as `init`/`/end`); never overwrite.
- **Guards:** require `continuation/` to exist (don't scaffold); skip any absent
  source dir silently.

Source → destination:

| From | To |
|---|---|
| `.claude/continuations/*.md` | `continuation/sessions/` |
| `.claude/learnings/*.md` | `continuation/learnings/` |
| `~/.claude/agent-army/<op>/` (all ops) | `continuation/agent-army/<op>/` |

The agent-army source defaults to `$HOME/.claude/agent-army` but accepts
`--agent-army-src <path>` (also honoured via env in tests) so it can run against
a temp home. Output ends with a summary line — `N copied, M skipped (identical),
K renamed (collision)` — and a reminder of which legacy dirs are now safe to delete.

## Section 4 — Per-tool trigger stubs (the C hybrid)

Canonical workflow prose is written **once** in `continuation/AGENTS.md`.
`init` generates only thin native triggers per tool, each delegating to the
spec:

- **Claude Code:** patch `CLAUDE.md` with an `@continuation/AGENTS.md` import,
  and drop slash-command stubs (`/end`, `/continue`, `/army`) whose body is a
  few lines: "follow the `<action>` workflow defined in
  `continuation/AGENTS.md`." `claude-continuation`'s existing commands are
  rewritten to this delegating form.
- **OpenCode:** write/merge a root `AGENTS.md` that references
  `continuation/AGENTS.md`, plus OpenCode command files mirroring the same
  triggers.
- **Antigravity:** write its native config entry pointing at
  `continuation/AGENTS.md` (read as AGENTS.md-style guidance).

Result: native `/end`, `/continue`, `/army` ergonomics in every tool, with a
single source of truth for the actual workflow. Updating the workflow = edit
`AGENTS.md`; stubs rarely change.

## Section 5 — Porting the two existing skills

- **claude-continuation:** `/end`, `/continue`, `/next` stop hardcoding
  `.claude/continuations/` and `.claude/learnings/`. They read paths and schema
  from `continuation/AGENTS.md` and write to `continuation/sessions/` and
  `continuation/learnings/`. The templates move to
  `continuation/templates/{session,learnings}.md` so the skill and CLI share
  them. Back-compat: if a repo has no `continuation/` dir, the skill offers to
  run `init` (or falls back to the legacy `.claude/` path for one release).
- **agent-army:** command centre and agent files target
  `continuation/agent-army/` (absolute path from worktrees). Templates move to
  `continuation/templates/{command-centre,agent-brief,agent-status}.md`.
  Launch/status scripts take the command-centre root as an argument defaulting
  to the main checkout's `continuation/agent-army/`.

## Testing strategy

1. **Automated (`node:test` + temp fixtures):** `init` against a throwaway repo
   produces the exact `continuation/` tree; `CLAUDE.md` gains the import; root
   `AGENTS.md` references the spec; `init` is idempotent (no duplicate imports);
   `-2`/`-3` collision suffix works; `validate` catches a malformed session.
2. **Local end-to-end (by hand):** `git init` a temp repo, run the CLI's
   `init`, inspect `continuation/` + patched config files.
3. **Acceptance — cross-tool round-trip:** in one throwaway repo, `/end` in
   Claude Code writes a session; OpenCode (then Antigravity) opens the same repo,
   reads `continuation/AGENTS.md`, and resumes from that session. A handoff
   written by one tool and resumed by another is the pass condition.

## Out of scope (YAGNI for v1)

- Tools beyond the three named (Cursor, Codex, Gemini CLI get the generic
  AGENTS.md spine for free but aren't explicitly wired/tested in v1).
- Remote/synced continuation state; multi-repo aggregation.
- A hosted registry or web UI.

## Open follow-ups

- Exact Antigravity config file name/format to confirm during implementation.
- Whether `claude-continuation`'s legacy `.claude/` fallback is kept for one
  release or dropped immediately.
