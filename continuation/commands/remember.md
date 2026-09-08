---
description: Remember something — write a decision, learning or convention record to .continuation/ from what the user just said.
allowed-tools: Bash(node:*), Bash(grep:*), Bash(git:*), Read
argument-hint: <what to remember>
---

# /remember — Write a record now

`$ARGUMENTS` is the thing to remember. If empty, use the last substantive point in the conversation.

1. Classify: a choice between alternatives → `decision`; a non-obvious failure and its fix → `learning`; a "we always / never" rule → `convention`. If genuinely ambiguous, ask one question.
2. `grep -i "<key words>" .continuation/INDEX.md` to find a live record on the same subject. If one exists, you will supersede it.
3. Write it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" write --type <type> --tags <1-6 existing tags first> --summary "<≤120 chars>" [--files ...] [--supersedes <id>] --confidence high <<'EOF'
<body sections for the type per .continuation/AGENTS.md>
EOF
```

4. Print the helper's "Remembered:" line and nothing else.
