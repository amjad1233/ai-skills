# Changelog

## 0.2.2 — 2026-06-19

### Changed
- **Visible terminals by default; tmux demoted to headless-only.** The Front Door Q4 now offers
  a per-platform menu of *visible* terminal windows — **Terminal.app/iTerm/Warp** (macOS),
  **GNOME Terminal/Konsole/xterm** (Ubuntu/Linux), **Windows Terminal/PowerShell** (Windows) —
  led by the stock visible terminal. tmux is recommended only for SSH/headless, where there's no
  desktop to draw on (it's a hidden detached session).
- **`launch-agent.sh --terminal <name>`** — explicit substrate selection
  (`terminal-app|iterm|warp|gnome-terminal|konsole|xterm|windows-terminal|powershell|tmux|nohup`).
  `--tmux` is now an alias for `--terminal tmux`. Added launch paths for **iTerm** and **Warp**
  (via a `warp://` launch config) on macOS and **Windows Terminal/PowerShell** on Windows.
  Auto-detect (no flag) is visible-first and only falls back to tmux/nohup when headless.

## 0.2.1 — 2026-06-17

### Added
- **Two-session workflow made explicit** — agent-army is the *back half* of a spec → implement
  pipeline: Session A specs the app, Session B (this skill) groups the specs and implements them
  in parallel. Documented in SKILL.md and on the website.
- **Pluggable spec source** — a seam's brief can come from an **OpenSpec** change dir, **Todoist**
  tasks, **JIRA** tickets, or a plain **markdown** stub. Broadened in the Front Door interview.

## 0.2.0 — 2026-06-16

### Changed
- **Front Door** — reshaped the 0.1.0 Intake Gate into a `brainstorming`-style front door:
  a 3-question fit check (down from 6), an **advisory** route recommendation (was a hard stop),
  and a **one-question-at-a-time operation interview** (`references/front-door.md`) covering
  groups, integration branch, codename, terminal (auto-detected), models, permissions, babysit
  cadence, and stallSeconds — asked fresh each operation. No hook, no persisted config.

## 0.1.0 — 2026-06-11

First public release. Extracted from a private skill and hardened after a real four-agent
operation.

### Added
- **Intake Gate** at the front of the skill — fit-check + cost-preview + routing, so cheap work
  goes to in-session subagents or the Workflow tool instead of a fleet.
- **Window tracking** — `launch-agent.sh` records a runtime handle (`agents/<name>.runtime.json`:
  substrate, tmux target / Terminal.app window id + tty / pid). New `where.sh` locates each
  agent's window and tells you how to inspect and close it.
- **`stop-agent.sh`** — graceful, verified close of an agent's window/pane; kills idle-burn
  (a DONE agent left holding a live session).
- **Hardened liveness** — an agent counts as alive if its recorded PID runs, OR a process
  matches its brief path, OR a process cwd is under its worktree. Fixes the cwd-only probe that
  let live agents go invisible. The board now flags `IDLE-BURN` / `ORPHAN`.
- **Master review gate** — two-stage (spec-compliance then code-quality) in-session reviewer
  subagents before any merge, adapted from superpowers' subagent-driven-development.
- **Richer status vocabulary** — `DONE_WITH_CONCERNS` so the master reads doubts before merging.
- Docs: `DECISIONS.md` (design rationale), `references/agent-army-vs-subagents.md`, and a visual
  explainer (`docs/index.html` + `docs/diagram.svg`).
