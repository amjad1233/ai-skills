# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [1.0.0] - 2026-06-26

First stable release. Graduates the skill to 1.x and locks in the timestamped
handoff convention.

### Changed

- **BREAKING (convention):** Session and learning filenames now carry a
  timestamp prefix (`YYYY-MM-DDTHHMMSS-<slug>.md`, local time) instead of the
  date only. Each handoff is uniquely identifiable and lexically sortable into
  chronological order, so `/continue` resolves the latest session unambiguously
  even when several were written on the same day. The `-2`/`-3` collision suffix
  is kept as a same-second backstop.
- The in-file `**Session date:**` field is now `**Session timestamp:**`
  (`YYYY-MM-DDTHH:MM:SS`), giving `/continue`'s git reality-check sub-second
  precision.

### Migration

- **Existing date-only files keep working** — `/continue` still reads
  `YYYY-MM-DD-<slug>.md` handoffs and sorts them as older than any timestamped
  file, so no action is required.
- To bring old files fully onto the new convention (uniquely ordered, passes
  `validate`), run the optional one-time rename in
  [`MIGRATION.md`](MIGRATION.md).

[1.0.0]: https://github.com/amjad1233/ai-skills/releases/tag/claude-continuation-v1.0.0

## [0.2.0] - 2026-06-04

### Added

- `/next` slash command — opens the next session in a fresh terminal and
  auto-runs `/continue`. Worktree-aware (picks a target from `git worktree
  list`, or `/next <path|branch>` to target one directly), and labels each
  session with a distinct **title + colour** so parallel worktree sessions
  are easy to tell apart. Supports Terminal.app, Ghostty, iTerm2 (window) and
  Warp (new tab); colour is best-effort per terminal and stable per worktree.
  macOS only.

[0.2.0]: https://github.com/amjad1233/claude-continuation/releases/tag/v0.2.0

## [0.1.0] - 2026-05-27

### Added

- `/end` slash command — captures a session handoff to `.claude/continuations/`
  and optional learnings to `.claude/learnings/`.
- `/continue` slash command — reads the latest continuation file, runs a
  read-only git reality check, and orients the next session.
- Plugin manifest (`plugin.json`) and self-hosted marketplace manifest
  (`marketplace.json`) for install via `/plugin marketplace add` +
  `/plugin install`.
- Beginner-friendly README covering install, first session walkthrough,
  troubleshooting, and FAQ.

[0.1.0]: https://github.com/amjad1233/claude-continuation/releases/tag/v0.1.0
