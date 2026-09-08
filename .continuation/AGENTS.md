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
