---
description: End the session — write a session record to .continuation/sessions/ and any decisions, learnings or conventions not yet captured.
allowed-tools: Bash(git:*), Bash(node:*), Bash(ls:*), Bash(test:*), Bash(grep:*), Read, AskUserQuestion
---

# /end — Session handoff

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs"`. Call it `CONT` below.

## 1. Capture

Run in parallel: `git rev-parse --abbrev-ref HEAD`, `git status --short`, `git log --oneline -5`, `git diff --stat`. Skip if not a git repo.

Review the conversation for: what was completed, what is unfinished, the next concrete task, key files, and any decision, learning or convention that was reached during the session but not yet written to `.continuation/`. Check `.continuation/INDEX.md` (read it, or `grep`) so you do not duplicate an existing record.

**Short-session guard:** if the session was brief (few messages, no commits, no edits) ask *"Short session — write a handoff anyway?"* Default no. If no, stop.

## 2. Write outstanding records first

For each uncaptured decision / learning / convention, pipe the body to:

```bash
CONT write --type <decision|learning|convention> --tags a,b --summary "<≤120 chars>" [--files p,q] [--supersedes <id>] [--confidence high|medium|low] <<'EOF'
## <sections for the type, see .continuation/AGENTS.md>
EOF
```

Print each "Remembered:" line the helper returns.

## 3. Write the session record

Draft it inline, then pipe it:

```bash
CONT write --type session --tags <2-4 topic tags> --summary "<topic in ≤120 chars>" --files <key files> --confidence high <<'EOF'
## What was done
- ...

## Current state
- **Working:** ...
- **Not yet:** ...
- **Uncommitted changes:** <from git status, or none>

## Next task
<one unambiguous instruction>

## Key files
- `path` — why

## Notes
<optional; omit heading if empty>
EOF
```

Keep it under 150 lines. Then print:

```
=== SESSION ENDED ===
Session:  <path the helper printed>
Records:  <n> new decision/learning/convention records
Next:     /continue
```

## Rules

- Never hand-edit `HOT.md` or `INDEX.md`; the helper rebuilds them.
- Do not lint, commit or push. Not this command's job.
- If the helper is missing, write the files by hand following `.continuation/AGENTS.md`.
