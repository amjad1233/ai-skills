---
description: Resume — read .continuation/HOT.md and the latest session record, reality-check the repo, orient.
allowed-tools: Bash(git:*), Bash(node:*), Bash(ls:*), Bash(test:*), Bash(grep:*), Read, AskUserQuestion
---

# /continue — Resume from the last session

Read-only apart from rebuilding the derived files.

## 1. Load memory

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" rebuild --if-stale --print-hot
```

If it prints nothing, `.continuation/` does not exist:

- **Old folders present** (`.claude/continuations/` or `.claude/learnings/`): run `node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" migrate` without asking, print its counts in one line, then rerun the rebuild command above and carry on. Remind the user to commit `.continuation/` and delete the old folders when satisfied.
- **Nothing to migrate:** say so, offer `init`, read `CLAUDE.md`/`AGENTS.md` and `git log --oneline -10` as fallback orientation, and stop.

## 2. Pick the session record

From `.continuation/INDEX.md`, sessions are listed newest first with their `branch` and `auto` columns. Choose:

1. The newest session whose `branch` equals the current branch and `auto: false`.
2. Else the newest session on the branch, even if `auto: true` (say it is an auto checkpoint).
3. Else the newest session overall (say it is from another branch).

If a non-auto session and a newer auto checkpoint both exist on the branch and the checkpoint is under 24 hours newer, read the non-auto one for narrative and the checkpoint's `## Current state` for git state.

Read the chosen file in full.

## 3. Reality-check

`git rev-parse --abbrev-ref HEAD`, `git status --short`, `git log --format="%h %ad %s" --date=short -5`. Compare with the record: branch mismatch, newer commits than the record's timestamp, working tree that does not match its "Uncommitted changes". Flag each; never auto-switch branches.

## 4. Orient

```
=== RESUMING SESSION ===

Project:        <from HOT.md header>
Last session:   <date> — <summary>   (<rule used: branch / branch-auto / newest>)
Branch:         <live>  <(mismatch — record said X)>
Working:        <from record>
Not yet:        <from record>
Uncommitted:    <live git status summary>
Next task:      <from record>

Key files:
  - <path> — <why>

Conventions and decisions in play: see HOT.md above.
```

## 5. Hand back

End with exactly: **"Ready to pick up from here, or doing something different?"** Then wait.
