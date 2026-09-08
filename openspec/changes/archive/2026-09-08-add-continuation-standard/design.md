## Context

`agent-army` and `claude-continuation` write their artifacts to `.claude/` paths and ship as Claude Code plugins. That locks their session-handoff workflow to one tool. OpenSpec demonstrates a portability model worth copying: a tool-neutral artifact directory at the repo root, a single canonical spec any agent reads, and a thin CLI that scaffolds it. This change extracts that model into a reusable `continuation` standard, built as a new package inside this monorepo rather than a separate repo. Source of truth for templates is shared by both the CLI and (eventually) the two existing skills, so a "session" file is defined once, not three times.

Locked decisions from brainstorming: one shared standard the whole repo adopts; distributed as a thin `npx` CLI; instruction-sync via the **C-hybrid** model (canonical prose once in `continuation/AGENTS.md`, CLI generates only small native trigger stubs); v1 target tools are Claude Code, OpenCode, Antigravity.

## Goals / Non-Goals

**Goals:**
- A handoff written by one tool is resumable by another — the cross-tool round-trip is the acceptance criterion.
- A `continuation/` directory contract that is self-describing via `continuation/AGENTS.md`.
- A small, dependency-free Node CLI (`init`, `validate`, `list`, `archive`, `update`, `migrate`) that is idempotent and testable.
- A non-destructive adoption path for existing `.claude/`-based installs.

**Non-Goals:**
- Rewiring the `claude-continuation` skill (follow-on Plan 2) or the `agent-army` skill (follow-on Plan 3). This change only reserves and documents `continuation/agent-army/`.
- Tools beyond the three named (Cursor, Codex, Gemini get the generic AGENTS.md spine for free but aren't explicitly wired/tested in v1).
- Remote/synced continuation state, multi-repo aggregation, hosted registry, or web UI.

## Decisions

**The `continuation/` contract.** Committed: `AGENTS.md`, `continuation.config.json`, `sessions/`, `learnings/`, `archive/`. Gitignored: `agent-army/` (live fleet state, main checkout only). `sessions/` is the renamed legacy `continuations/` subdir, avoiding a stutter against the parent `continuation/`. *Alternative considered:* keep everything under `.continuation/` hidden — rejected because the directory is meant to be a visible, committed, shareable record.

**C-hybrid instruction sync.** Canonical workflow prose lives once in `continuation/AGENTS.md`; `init` generates only thin native triggers per tool (Claude slash-command stubs + a `@continuation/AGENTS.md` import in `CLAUDE.md`; an OpenCode root `AGENTS.md` reference + command files; an Antigravity config entry). *Alternative considered:* duplicate full instructions per tool — rejected; updating the workflow would mean editing N copies.

**Node, zero-dep, `npx`-first.** ESM, `node:test`, no runtime dependencies, so `npx @amjad1233/continuation` works directly. *Alternative considered:* a Bun/Deno or shell implementation — rejected for the broadest `npx` reach with least toolchain assumption.

**agent-army collision avoidance via absolute path.** The command centre was originally external to the repo so parallel worktree agents wouldn't collide and it survived branch switches. Under the standard it lives at `continuation/agent-army/` in the **main** checkout only, gitignored; worktree agents receive the absolute path rather than their own copy, preserving the single-shared-location property. This is a path change, not a model change.

**`migrate` is copy-only and idempotent.** It copies legacy `.claude/continuations`, `.claude/learnings`, and `~/.claude/agent-army/<op>` into the standard layout, never deleting sources. Re-runs skip byte-identical destinations; a name clash with differing content gets the standard `-2`/`-3` suffix. It applies immediately (safe because copy-only) with a `--dry-run` preview, and requires `continuation/` to already exist. The agent-army source defaults to `$HOME/.claude/agent-army` with a `--agent-army-src` override for testability. *Alternative considered:* move/delete originals — rejected; a botched move loses history, and copy-leave-legacy makes immediate apply safe.

## Risks / Trade-offs

- **Stale legacy copies after migrate** → `migrate` prints exactly which legacy dirs are now safe to delete; user removes them by hand once verified.
- **Antigravity config format uncertainty** → confirm the exact native config file name/format during implementation (Open Question below); adapter is isolated so a late change is low-blast-radius.
- **Two sources of truth during the transition** (legacy `.claude/` + new `continuation/` until Plans 2–3 land) → acceptable and bounded; `migrate` bridges them and the existing skills are untouched here, so nothing regresses.
- **Idempotency bugs duplicating artifacts** → covered by `node:test` fixtures asserting re-run produces zero changes and collision-suffix behaviour.

## Migration Plan

1. Land this change (CLI + standard core); no consumer is affected until they opt in.
2. Existing install adopts: `npx @amjad1233/continuation init` then `continuation migrate` (non-destructive).
3. Verify `continuation/sessions/` etc. populated, then optionally delete legacy `.claude/` dirs as prompted.
4. Follow-on changes (Plans 2 & 3) rewire the skills to read/write the standard, at which point the legacy `.claude/` fallback can be dropped.
5. **Rollback:** delete the `continuation/` directory and revert the patched config files; legacy `.claude/` artifacts are untouched, so the old workflow keeps working.

## Open Questions

- Exact Antigravity config file name/format — confirm during implementation.
- Whether `claude-continuation`'s legacy `.claude/` fallback is kept for one release or dropped immediately once `migrate` exists (the migration path makes dropping it more defensible).
