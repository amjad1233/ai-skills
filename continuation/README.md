# continuation

Project memory for any coding agent. Decisions, learnings, conventions and session
handoffs live as typed markdown records in `.continuation/` at your repo root. The agent
writes them as it works, reads a 40-line `HOT.md` at every session start, and pulls
detail by tag only when a task needs it.

## Install

Claude Code:

```
/plugin marketplace add amjad1233/ai-skills
/plugin install continuation@amjad1233
```

opencode, Codex, Cursor, Gemini CLI and anything else that reads skills:

```
npx skills add amjad1233/ai-skills --skill continuation
```

Then in each repo: `node <plugin>/scripts/continuation.mjs init` (Claude Code:
`/continue` offers it).

## Migrate from old

Coming from `claude-continuation` (`.claude/continuations/` and `.claude/learnings/`)?
The agent does this for you: the first time it sees the old folders and no
`.continuation/`, it runs the migration, tells you the counts, and carries on. To do it
yourself:

```bash
# one repo (run from anywhere inside it)
node <plugin>/scripts/continuation.mjs migrate

# every repo under a directory, e.g. all your projects
node <plugin>/scripts/continuation.mjs migrate --all ~/projects
```

`<plugin>` is `~/.claude/plugins/marketplaces/amjad1233/continuation` for the Claude Code
plugin, or wherever `npx skills add` put the skill. What happens:

- every old handoff and learning becomes one typed record with frontmatter; bodies are
  copied unchanged
- undated living learning files are split into one record per `##` section
- sources are left in place, and running it again is a no-op
- nothing is committed for you

Then review `.continuation/`, commit it, and delete `.claude/continuations/` and
`.claude/learnings/` when you're happy. Details in [MIGRATION.md](MIGRATION.md).

## Commands

| Command | Does |
|---|---|
| `/continue` | Load HOT.md, read the latest session on your branch, reality-check git, orient |
| `/end` | Write outstanding records, then the session handoff |
| `/remember <text>` | Write one decision / learning / convention now |
| `/continuation-review` | Conflicts, stale, thin, orphan tags, long chains — you decide keep / retire / merge / retag |
| `/next` | Open the next session in a fresh terminal (Claude Code, macOS) |

The agent also writes records on its own when a decision is made, a non-obvious failure
is fixed, a convention is stated, or a commit/PR lands. It says `Remembered: …` each time.

## Layout

```
.continuation/
├── AGENTS.md        # the contract, committed
├── HOT.md           # derived, gitignored, ≤ 40 lines
├── INDEX.md         # derived, gitignored
├── decisions/  learnings/  conventions/  sessions/
```

One file per record, YAML frontmatter, no author field. Two developers never touch the
same file, and the derived files are never committed, so git merges are additions only.

## Auto checkpoints (Claude Code)

Hooks on `PreCompact` and `SessionEnd` write a low-confidence session record from git
state so a compaction or a closed terminal never loses the branch and diff. `/end` still
captures the narrative.

## Helper

`scripts/continuation.mjs` — Node ≥ 18, zero dependencies. `init`, `rebuild`, `write`,
`checkpoint`, `review`, `migrate`. `--help` for flags. Tests: `node --test scripts/test/`.

MIT.
