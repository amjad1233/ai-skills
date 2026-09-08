---
id: 2026-08-13T133231-skills-sh-compat
type: learning
status: active
tags: [skills, compat]
summary: skills.sh ecosystem compat
branch: —
files: []
supersedes: —
superseded_by: —
confidence: medium
auto: false
---

**Session timestamp:** 2026-08-13T13:32:31

## The clack-style installer TUI belongs to `npx skills`, not the skill author
- **What happened:** Rebuilt an installer that mattpocock gets for free from vercel-labs/skills.
- **Rule:** Before building install tooling, check whether the ecosystem CLI (`npx skills add <owner>/<repo>`) already covers it — repos only need SKILL.md files in discovered roots.

## `.claude/skills/` is a skills.sh discovery root
- **What happened:** Vendored openspec skills leaked into our public listing; commands-only plugins were invisible.
- **Rule:** `metadata.internal: true` hides a skill from `npx skills` discovery; a plugin needs a SKILL.md (not just commands/*.md) to be portable.
- **Example:** verify with `npx -y skills@latest add . --list`
