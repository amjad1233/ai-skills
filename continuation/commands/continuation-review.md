---
description: Review project memory — conflicts, stale, thin, orphan tags and long chains in .continuation/, with one proposed action each.
allowed-tools: Bash(node:*), Bash(git:*), Bash(grep:*), Read, Edit, AskUserQuestion
---

# /continuation-review — Curate memory

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/continuation.mjs" review --json` and parse it.
2. **Conflict candidates:** for each pair, read both records. Decide whether they contradict. If they do not, drop the pair silently.
3. Present every remaining item in this priority order — conflicts, stale, thin, orphan tags, long chains — one line each with one proposed action: **keep**, **retire**, **merge**, **retag**. Use `AskUserQuestion` per item, or accept "apply all".
4. Apply:
   - **retire:** edit the record's frontmatter to `status: retired`. Never delete.
   - **merge:** write one new record with `write … --supersedes <id-a>` containing the merged body, then edit the other inputs to `status: superseded`, `superseded_by: <new id>`.
   - **retag:** edit `tags` in the frontmatter.
5. Run `… rebuild` and print counts: reviewed, retired, merged, retagged, kept.

Nothing is ever deleted by this command.
