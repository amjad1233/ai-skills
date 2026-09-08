---
id: 2026-08-13T133231-skills-sh-compat
type: session
status: active
tags: [skills, compat]
summary: claude-skills — skills.sh ecosystem compat
branch: —
files: []
supersedes: —
superseded_by: —
confidence: medium
auto: false
---

**Session timestamp:** 2026-08-13T13:32:31
**Branch:** main

## What was done this session
- Merged PR #12 (`4b15618`): repo now installable via `npx skills add amjad1233/claude-skills`
- Hid vendored openspec skills from ecosystem discovery (`metadata.internal: true`)
- Added portable `claude-continuation/skills/claude-continuation/SKILL.md` (end/continue loop; `/next` stays plugin-only)
- READMEs: skills.sh badge, "two ways in" install section, per-skill npx lines
- Fixed pre-existing guard failure on main (absolute home path in old plan doc replaced with a placeholder)
- Built then deleted a bespoke clack-style installer CLI — superseded by `npx skills` (vercel-labs/skills)
- Ran /code-review (5 reviewers + confidence scoring): no confirmed issues

## Current state
- **Working:** `npx skills add . --list` returns exactly agent-army + claude-continuation; all CI checks green on main
- **Not yet:** skills.sh listing unverified — badge may 404 until the repo is first installed/crawled
- **Uncommitted changes:** none

## Next task
Check https://skills.sh/amjad1233/claude-skills renders (install once via npx to trigger crawl if not). If it's listed, done; otherwise investigate how skills.sh indexes repos.

## Key files
- `claude-continuation/skills/claude-continuation/SKILL.md` — portable end/continue skill; keep in sync with `commands/end.md`/`continue.md` when those change
- `.claude/skills/openspec-*/SKILL.md` — carry `metadata.internal: true`; don't strip it
- `.github/scripts/check-personal-data.sh` — repo-wide guard; run locally before pushing docs

## Notes
- `claude-continuation/README.md:33` still says `marketplace add amjad1233/claude-continuation` (old repo) — small follow-up
- Agent Army portability roadmap item still open; continuation one is ticked
