# Front Door — design spec

**Date:** 2026-06-16
**Branch:** `worktree-front-door`
**Status:** approved for implementation

## Problem

The agent-army skill's `⛔ Intake Gate` already triages "army vs cheaper tool", but it
is not shaped like the superpowers `brainstorming` front door the user wants:

- It is a checklist you "walk", not a structured **one-question-at-a-time** interview.
- It **hard-stops** ("proceed only if the route is ARMY, else stop") rather than giving
  an **advisory recommendation** the user can override.
- Operation preferences (terminal, models, permissions) are documented only in the
  *Launching* section — they are not **asked up front**.

## Goal

Reshape the existing Intake Gate into a `brainstorming`-faithful **Front Door**, split
per option B (lean SKILL.md + a loaded reference), with these confirmed decisions:

| Decision | Choice |
| --- | --- |
| Delivery | Stay a skill (no hook, no plugin conversion) |
| Triage stance | Advisory recommendation (user can override) |
| Interview style | One question at a time (brainstorming-faithful) |
| Preference memory | Ask fresh every operation (no persisted config) |
| Structure | Lean SKILL.md + `references/front-door.md` |
| Fit-check size | 3 questions (down from 6) |

## Design

### 1. SKILL.md (inline, always loaded)

Rename `⛔ Intake Gate` → **`⛔ Front Door — run this FIRST`**, restructured to mirror
`brainstorming`:

- **Checklist (create one todo per item):**
  1. Fit check — 3 questions (below)
  2. Advisory recommendation — state the routing call + reasoning, defer to user
  3. Cost-preview consent
  4. Operation interview — load `references/front-door.md`, ask one question at a time
  5. Confirm operation summary (echo the manifest back)
  6. Launch + verify
- **A dot-graph flow** mirroring brainstorming's: Fit check → Recommend → Consent →
  Interview → Confirm → Launch.
- **One-question-at-a-time** stated as a hard principle.
- The routing table is retained as the *reasoning aid* behind the recommendation.

**Fit check — 3 questions (folded from the old 6):**

1. **Independent seams?** — How many genuinely independent groups, each with a spec,
   *not* touching the same files? (folds old Q1 decomposed + Q2 count + Q4 shared-state).
   `<2 independent → not a fleet`.
2. **Big & time-pressured?** — Is each seam hours of work *and* is wall-clock the binding
   constraint? (folds old Q3 size + Q5 deadline). `Small/mechanical → Workflow.
   No deadline → sequential is cheaper`.
3. **Human will babysit?** — Will someone check in to clear BLOCKED decisions?
   `No → don't launch`.

**Advisory recommendation (replaces the hard-stop):**

> **Recommendation:** `<ARMY | Workflow | subagents | sequential>` — because `<reason>`.
> This is advisory. Say "proceed with the fleet" to override, or I'll route you to the
> lighter tool.

### 2. references/front-door.md (loaded on entry)

The interview script. One question at a time, multiple-choice where possible, the
**recommended option first**, asked **fresh every operation** (no stored config):

1. **Groups/seams** — confirm each group + its spec (OpenSpec dir or md brief).
   *Cannot be guessed — always asked.*
2. **Integration base + branch** — suggest `integration/<codename>` off the current branch.
3. **Codename** — offer a generated memorable one.
4. **Terminal** — **auto-detect present substrates** and offer only those. Probe:
   `$TERM_PROGRAM`, `command -v tmux`, `$SSH_TTY`/headless, iTerm/Ghostty in
   `/Applications`. Recommend tmux for SSH/headless, Terminal.app on mac desktop; carry
   the Ghostty-orphan warning.
5. **Models** — uniform-sonnet (default) vs by-size.
6. **Permissions** — autonomous (`--dangerously-skip-permissions`) vs supervised, with
   the trade-off spelled out.
7. **Babysit cadence** — confirm a human checks in; capture a rough interval.
8. **stallSeconds** — default 900, only if they care.

**Terminus:** the interview writes answers into `manifest.json` (the existing spine) +
`COMMAND.md`, then returns to SKILL.md lifecycle step 3 (create command centre) → 4
(launch).

### 3. Scope guards

- No hook, no persisted config.
- Existing scripts and templates are unchanged — this is purely the front-door reshape.
- Verification = dry walkthrough: re-read for contradictions, confirm referenced files
  exist, confirm the SKILL.md description front-matter still points at the gate.

## Out of scope

- Plugin/hook conversion.
- Persisted operator config (`config.json`).
- Any change to launch/health/teardown scripts.
