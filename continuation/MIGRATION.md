# Migrating from claude-continuation to continuation 2.0

Handoffs move from `.claude/continuations/` and `.claude/learnings/` into
`.continuation/` as typed records with frontmatter.

One repo:

```
node <plugin>/scripts/continuation.mjs migrate
```

Every repo under a directory:

```
node <plugin>/scripts/continuation.mjs migrate --all ~/projects
```

What it does: timestamped and date-only files become one record each (date-only get
`T000000`), bodies copied verbatim; undated living learning files are split into one
learning per `##` section. Everything gets `confidence: medium`. Sources are left in
place; re-running is a no-op. Nothing is committed for you.

When satisfied: delete `.claude/continuations/` and `.claude/learnings/`, remove their
`.gitignore` lines if you had them, commit.

Plugin path: `claude-continuation@amjad1233` → `continuation@amjad1233`. Commands keep
their names; `/remember` and `/continuation-review` are new.
