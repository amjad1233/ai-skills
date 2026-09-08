# Continuation: project memory — design

**Status:** draft for review
**Supersedes:** `2026-06-21-continuation-standard-design.md` and the dormant
`openspec/changes/add-continuation-standard` change (both retired by this design).
**Replaces:** the `claude-continuation` plugin (renamed to `continuation`).

## 1. Goal

Give any coding agent (Claude Code, opencode, Codex, Cursor, Gemini CLI) a shared,
structured, git-friendly memory of a project: what was decided, what was learnt, what
conventions hold, and where the last session left off. Memory is written autonomously by
the agent during work, read cheaply at every session start, and kept honest by a
periodic human review.

Non-goals: cross-project memory about the user, embeddings or semantic search, a hosted
service, a database.

## 2. Decisions taken during brainstorming

| Question | Decision |
|---|---|
| Scope | Project memory: handoffs plus durable decisions, learnings, conventions |
| Who writes | The agent, autonomously, during work. Plus `/end` at session close |
| Who reads | Tiered: a hot summary every session, full index and records on demand |
| Conflicts | Newest record supersedes on the same subject. `/continuation-review` surfaces conflicts, stale and thin records for human pruning |
| Storage | One markdown file per record with YAML frontmatter. Derived index files, never committed |
| Author tracking | None. Records carry no dev name. Branch is the only provenance |
| Folder | `.continuation/` at the repo root |

## 3. Naming

The plugin, skill and folder are all called **continuation**. It drops the `claude-`
prefix from the current plugin, keeps `/continue` and `/end` as the natural verbs, and
now covers durable records as well as handoffs. Command names:

| Command | Purpose |
|---|---|
| `/end` | Close a session: write the session record, rebuild indexes |
| `/continue` | Open a session: read hot summary, latest session, orient |
| `/remember <text>` | Force-write a record from a user statement |
| `/continuation-review` | Hygiene pass: conflicts, stale, thin, orphaned tags |
| `/next` | Unchanged from today. Claude Code plugin only, macOS only |

Each command ships as its own file under `continuation/commands/` so it appears as a real
slash command in Claude Code. The skill mirrors the same behaviour for agents that only
load `SKILL.md`.

Skill triggers stay broad: "remember this", "what did we decide about", "pick up where
we left off", "end the session".

## 4. On-disk layout

```
.continuation/
├── AGENTS.md            # the contract, committed, read by every agent
├── HOT.md               # derived, gitignored, ≤ 40 lines, loaded every session
├── INDEX.md             # derived, gitignored, one row per live record
├── decisions/
│   └── 2026-09-08T083012-stripe-webhook-verification.md
├── learnings/
│   └── 2026-09-08T091400-sail-mysql-port-clash.md
├── conventions/
│   └── 2026-09-08T092210-conventional-commits.md
└── sessions/
    └── 2026-09-08T173000-stripe-webhooks.md
```

`.gitignore` gains two lines: `.continuation/HOT.md` and `.continuation/INDEX.md`. Everything else is
committed. Derived files are rebuilt from frontmatter on every write and on `/continue`
if missing or older than the newest record, so two developers never merge them.

Filename: `{YYYY-MM-DDTHHMMSS}-{slug}.md`, local time, slug 2–5 lowercase hyphenated
words starting with a letter. Same-second collision appends `-2`, `-3`. Never overwrite.

## 5. Record schema

Every record is markdown with this frontmatter. Fields marked * are required.

```yaml
---
id: 2026-09-08T083012-stripe-webhook-verification   # * equals filename without .md
type: decision          # * decision | learning | convention | session
status: active          # * active | superseded | retired
tags: [stripe, webhooks, security]                   # * 1–6 lowercase kebab-case
summary: Verify Stripe signatures with the SDK, never hand-roll HMAC   # * ≤ 120 chars
branch: feat/stripe     # branch at write time, "—" outside git
files: [app/Http/Controllers/StripeWebhookController.php]   # paths this record is about
supersedes: 2026-09-01T140000-stripe-webhook-hmac            # id of the record replaced
superseded_by: —        # filled in on the old record when a new one supersedes it
confidence: high        # high | medium | low — agent's own estimate at write time
auto: false             # true only on hook-written checkpoints
---
```

Body sections by type:

| Type | Body |
|---|---|
| `decision` | `## Context`, `## Decision`, `## Consequences` |
| `learning` | `## What happened`, `## Rule`, `## Example` (optional) |
| `convention` | `## Rule`, `## Why`, `## Example` (optional) |
| `session` | `## What was done`, `## Current state`, `## Next task`, `## Key files`, `## Notes` (optional) |

Bodies stay under 60 lines for decision/learning/convention and under 150 for session.
Past that the agent is capturing detail instead of distilling.

`confidence` is the one field the agent sets honestly at write time and never edits. It
exists solely so `/continuation-review` can rank what to look at first. It does not affect
retrieval.

## 6. Derived files

### HOT.md

The only thing loaded unconditionally. Hard cap 40 lines. Built as:

1. Header: project name, record counts by type, date of newest record.
2. Up to 8 `convention` summaries, newest first.
3. Up to 8 `decision` summaries, newest first.
4. Up to 8 `learning` summaries, newest first.
5. Latest `session` summary and its `Next task` line.
6. Closing line: "Full index: .continuation/INDEX.md. Records: .continuation/{type}/. Filter by tag with grep."

Only `status: active` records appear. If a type has more than 8 active records the rest
are reachable through INDEX.md. This keeps per-session cost fixed regardless of how
large memory grows.

### INDEX.md

One markdown table, newest first, all `active` records:

```
| id | type | tags | summary |
```

Superseded and retired records are listed in a second, collapsed table at the bottom
under `## History` so an agent can trace a supersession chain without opening files.

## 7. Write path (autonomous)

The agent writes a record when, during work, one of these fires:

| Trigger | Type |
|---|---|
| A choice was made between alternatives and it affects future work | `decision` |
| Something failed for a non-obvious reason and the fix is reusable | `learning` |
| A "we always / we never" rule was stated or discovered | `convention` |
| The user says "remember", "note that", "going forward" | matches content, via `/remember` |
| Session closes | `session` via `/end` |
| A commit or PR lands, or the user says "done for now" | `session`, written by the agent without being asked |
| Context is about to be compacted, or the session ends without `/end` | `session` checkpoint, written by a hook (see §7.1) |

Rules for autonomous writes:

- Write the record, rebuild HOT.md and INDEX.md, and say so in one line: "Remembered:
  {summary} (.continuation/decisions/{id}.md)". No approval gate. The user can retire it later.
- Before writing, grep INDEX.md for overlapping tags. If a live record covers the same
  subject, the new record sets `supersedes` and the old record's `status` and
  `superseded_by` are updated. Same subject means same primary tag and the summary
  clearly addresses the same rule or choice. When unsure, write a fresh record without
  `supersedes` and let review catch it.
- Never write from speculation. A decision is recorded when it is made, not when it is
  proposed.
- One record per fact. Two facts, two files.
- Tags come from the existing tag set first. A new tag is allowed when no existing tag
  fits; `/continuation-review` reports tags used only once.

### 7.1 Automatic checkpoints

No agent exposes its context usage to the model, so the threshold trigger lives in the
harness. Claude Code fires two hooks that both run `continuation.mjs checkpoint`:

| Hook | When |
|---|---|
| `PreCompact` | Right before the context window is compacted |
| `SessionEnd` | The session closes without `/end` |

`checkpoint` is mechanical and needs no model: it writes a `session` record from
`git rev-parse --abbrev-ref HEAD`, `git status --short`, `git log --oneline -10`,
`git diff --stat`, and copies `## Next task` and `## Key files` forward from the newest
session record on the same branch. It sets `auto: true` and `confidence: low`, and its
summary reads "Auto checkpoint at {time}". It skips writing if a session record on the
same branch is under 10 minutes old, so a compaction storm does not spam records.

`/continue` prefers a model-written session record over an auto checkpoint when both
exist on the branch and the checkpoint is newer by under 24 hours. Otherwise newest wins.
`/continuation-review` lists auto checkpoints older than 7 days as thin.

Other agents: the skill rule "write a session record after each commit or PR" is the
portable fallback and needs no hook. opencode and Codex hook systems can call the same
`checkpoint` command; wiring them is a follow-up, not part of this design.

## 8. Read path

At session start, in order:

1. Read `.continuation/AGENTS.md` if present. It is short and states the contract, including
   "read HOT.md now".
2. Read `.continuation/HOT.md`. Rebuild it first if missing or stale.
3. Do not read anything else until a task calls for it.

During work, when a task touches a subject: grep `INDEX.md` for its tags or file paths,
then open only matching records. The skill instructs the agent to do this before
proposing an approach on anything non-trivial.

`/continue` additionally reads the latest `session` record in full, runs the read-only
git reality check from the current skill (branch mismatch, newer commits, working tree
drift), presents the orientation block, and stops.

Latest session resolution: the newest `session` record whose `branch` equals the current
branch. If none, the newest overall, stated as such. No author matching.

## 9. Review path

`/continuation-review` is the only place a human curates. It rebuilds indexes, then lists, in
priority order:

1. **Conflicts** — two active records of the same type sharing their first two tags,
   written at different times, whose summaries contradict. The helper lists candidate
   pairs; the agent reads them and decides. Records split from one migrated file share a
   timestamp and are never paired with each other.
2. **Stale** — active records whose `files` no longer exist, or whose `branch` was
   deleted and merged more than 30 days ago.
3. **Thin** — `confidence: low`, or body under 3 lines.
4. **Orphan tags** — tags used by exactly one record.
5. **Long chains** — a subject superseded more than 3 times, suggesting churn worth
   collapsing into one convention.

For each item the agent proposes one action: keep, retire, merge, retag. The user
answers per item or "apply all". Retire sets `status: retired`; the file stays. Merge
writes one new record superseding the inputs. Nothing is ever deleted by the tool.

## 10. Portability

Three layers, thinnest on the outside:

| Layer | Ships as | Used by |
|---|---|---|
| Contract | `.continuation/AGENTS.md`, scaffolded into each repo | Every agent, read at session start |
| Skill | `continuation/skills/continuation/SKILL.md` plus `references/` | Claude Code (plugin), opencode, Codex, Cursor via `npx skills add amjad1233/ai-skills --skill continuation` |
| Helper | `continuation/scripts/continuation.mjs`, zero dependencies, Node ≥ 18 | Called by the skill for `rebuild`, `review --report`, `init`, `migrate` |

The helper does the mechanical parts so the rules live in one place rather than being
re-implemented in prose per agent: parse frontmatter, validate schema, rebuild HOT.md and
INDEX.md, compute stale and orphan lists, apply supersession updates, migrate old
`.claude/continuations/` files. The agent does the judgement parts: deciding what to
remember, resolving conflicts, writing summaries.

An agent without a Node runtime can still follow the skill by hand. The skill states
the rebuild algorithm in prose as a fallback.

Claude Code specifics: a `SessionStart` hook runs `continuation.mjs rebuild --if-stale` and
prints HOT.md; `PreCompact` and `SessionEnd` hooks run `continuation.mjs checkpoint`
(§7.1). `/next` stays as is. Nothing else is Claude-only.

## 11. Migration from claude-continuation

Survey of the existing estate on 2026-09-08: about 60 repos, about 830
files, mostly committed. Three filename shapes exist: timestamped
(`YYYY-MM-DDTHHMMSS-slug.md`, 430 files), date-only (`YYYY-MM-DD-slug.md`, 386 files),
and undated living learning files (`worktree-and-ddev-gotchas.md`, about 20 files) that
hold many `##` sections appended over months. Session headings vary by era.

`continuation.mjs migrate [repo]` handles all three:

| Source | Result |
|---|---|
| `.claude/continuations/*.md` | One `session` record each. Body copied verbatim under its original headings; only frontmatter added. `summary` from the H1 |
| `.claude/learnings/YYYY-MM-DD*.md` | One `learning` record each, same treatment |
| `.claude/learnings/<undated>.md` | Split on `## ` headings into one `learning` record per section. Tags from the filename slug plus section title words. Timestamp from the file's git first-commit date, else mtime |
| Date-only filenames | Prefixed `T000000` so they sort before anything timestamped that day |

All migrated records get `confidence: medium`, `auto: false`, `branch: —`, and no
`supersedes`. `/continuation-review` is the place to link chains afterwards, not migrate.

Rules: sources are left in place and untouched. Re-running is a no-op because the
target id already exists. Same-id collisions from the split get `-2`, `-3`. The command
prints per-type counts and ends with "Sources untouched. Delete `.claude/continuations/`
and `.claude/learnings/` when satisfied." `.gitignore` gains the two derived-file lines
only; whether records are committed follows whatever the repo already did with the old
folder.

`continuation.mjs migrate --all <dir>` walks every git repo under a directory, runs the
single-repo migration, and prints a table of repo, sessions, learnings, splits, skipped.
It never commits. Committing per repo is a manual step.

The `claude-continuation` plugin directory is renamed to `continuation`.
`marketplace.json` lists `continuation` instead. `MIGRATION.md` explains the rename and
the one command to run.

Acceptance fixtures: `<client-repo-a>` (largest, 173 files, both undated and
timestamped learnings) and `<client-repo-b>`. Migrate, run `/continue`, confirm the
orientation matches the newest real handoff, and confirm a second migrate run changes
nothing.

## 12. Concurrency

Two developers, or two agents in parallel worktrees:

- Records never share a file, so git merges are additions only.
- Derived files are gitignored and rebuilt locally, so they never conflict.
- Supersession touches the old record's `status` and `superseded_by`. If two branches
  supersede the same record differently, git flags a two-line conflict on that record.
  Resolution rule in AGENTS.md: keep both new records active, set `superseded_by` to the
  one merged first, and let `/continuation-review` catch the pair as a conflict.
- Filenames carry a timestamp to the second. Two agents writing the same slug in the
  same second on different branches produce identical filenames with different content.
  Git flags it; the resolver renames one with `-2`. Rare enough not to design around.

## 13. Error handling

| Situation | Behaviour |
|---|---|
| `.continuation/` missing | `/continue` and the session hook say so and offer `continuation.mjs init`. Autonomous writes create the folder and AGENTS.md on first write |
| Malformed frontmatter | `rebuild` skips the file, lists it under `## Invalid` in INDEX.md with the reason. Never fails the whole rebuild |
| Not a git repo | `branch: —`, git checks skipped, everything else works |
| HOT.md over 40 lines | Rebuild truncates per-type lists until it fits. Never emitted oversize |
| Record referenced in `supersedes` does not exist | Kept as written, reported by review |

## 14. Testing

The helper gets `node --test` coverage for: frontmatter parse and validate, rebuild
output shape and the 40-line cap, supersession updates, stale and orphan detection,
migrate idempotency and collision suffixing, init idempotency. Tests use a temp git repo
fixture.

The skill gets a manual acceptance run: init a throwaway repo, work a session in Claude
Code that produces one record of each type, `/end`, then `/continue` from opencode and
confirm the orientation matches. The user runs tests; the agent names the command.

## 15. Out of scope, deliberately

- Cross-project or user-level memory.
- Semantic search, embeddings, a vector store.
- Confidence affecting retrieval order.
- Author or ownership fields.
- A daemon, a server, a background process of any kind.
- Editing records from a UI.
