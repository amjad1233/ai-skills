## Why

The two skills in this monorepo (`agent-army`, `claude-continuation`) are Claude-Code-native: their artifacts and instructions are hardcoded to Claude's plugin format and `.claude/` paths, so OpenCode, Antigravity, and other agentic tools can't read or write the same session handoffs. We want OpenSpec's portability model — a tool-neutral directory of artifacts plus a single spec any agent reads, wired up by a thin CLI — so a handoff written by one tool is resumable by another.

## What Changes

- Introduce **`continuation`** — a tool-neutral standard + thin `npx @amjad1233/continuation` CLI that scaffolds a `continuation/` directory any AI tool reads/writes.
- Canonical workflow prose lives once in `continuation/AGENTS.md` (C-hybrid model); the CLI generates only small native trigger stubs per tool (Claude Code, OpenCode, Antigravity).
- CLI commands: `init`, `validate`, `list`, `archive`, `update`, and `migrate` (a non-destructive, copy-only bridge from legacy `.claude/` artifacts into the standard).
- Session handoffs move from `.claude/continuations/` → `continuation/sessions/`; learnings from `.claude/learnings/` → `continuation/learnings/`; the agent-army command centre into a gitignored `continuation/agent-army/` (main checkout only).
- This change delivers **only** the CLI and standard core (Plan 1 of 3). Rewiring the `claude-continuation` skill (Plan 2) and the `agent-army` skill (Plan 3) are follow-on changes; this change only *reserves and documents* `continuation/agent-army/`.
- No **BREAKING** change to current installs: nothing here edits the existing skills, and `migrate` never deletes legacy files.

## Capabilities

### New Capabilities
- `continuation-format`: the tool-neutral `continuation/` directory contract — what is committed vs gitignored, the `YYYY-MM-DDTHHMMSS-slug.md` timestamped filename convention (uniquely identifiable, chronologically sortable), the never-overwrite collision rule, and the section schema for session and learning artifacts that every tool reads from `continuation/AGENTS.md`.
- `continuation-cli`: the `npx @amjad1233/continuation` command surface that scaffolds and maintains a `continuation/` directory — `init`, `validate`, `list`, `archive`, `update`, `migrate` — plus the per-tool adapter stubs.

### Modified Capabilities
<!-- None. The existing skills are unchanged by this change; their rewiring is deferred to follow-on changes (Plans 2 & 3). -->

## Impact

- **New package:** `continuation/` in this monorepo (npm `@amjad1233/continuation`, bin `continuation`, Node ≥18, ESM, zero runtime deps, tests via `node:test`).
- **Consumer repos:** running `init` adds a `continuation/` directory, patches `CLAUDE.md` / root `AGENTS.md` / Antigravity config with trigger stubs, and gitignores `continuation/agent-army/`. All idempotent.
- **No code touched** in `claude-continuation/` or `agent-army/` skill directories under this change.
- **Migration:** existing users adopt with one non-destructive `continuation migrate` run that copies legacy handoffs, learnings, and agent-army state into the new layout.
