# Record schema

Filename: `.continuation/<type>s/<id>.md`, `id = YYYY-MM-DDTHHMMSS-slug` (local time; slug
starts with a letter, lowercase letters, digits, hyphens, 2–5 words). Same-second
collisions append `-2`, `-3`. Never overwrite.

```yaml
---
id: 2026-09-08T083012-stripe-webhook-verification   # required, equals filename
type: decision          # required: decision | learning | convention | session
status: active          # required: active | superseded | retired
tags: [stripe, webhooks, security]                   # required, 1–6, lowercase kebab-case
summary: Verify Stripe signatures with the SDK, never hand-roll HMAC   # required, ≤ 120 chars
branch: feat/stripe     # branch at write time, — outside git
files: [app/Http/Controllers/StripeWebhookController.php]
supersedes: —           # id of the record this replaces
superseded_by: —        # set on the old record when replaced
confidence: high        # high | medium | low, set once at write time
auto: false             # true only on hook-written checkpoints
---
```

Body by type (keep decision/learning/convention under 60 lines, session under 150):

| type | sections |
|---|---|
| decision | `## Context`, `## Decision`, `## Consequences` |
| learning | `## What happened`, `## Rule`, `## Example` (optional) |
| convention | `## Rule`, `## Why`, `## Example` (optional) |
| session | `## What was done`, `## Current state`, `## Next task`, `## Key files`, `## Notes` (optional) |

Derived, gitignored, rebuilt by `rebuild`: `HOT.md` (header, ≤ 8 conventions, ≤ 8
decisions, ≤ 8 learnings, last session + next task, pointer line; hard cap 40 lines) and
`INDEX.md` (active table `| id | type | branch | auto | tags | summary |`, `## History` table for
superseded/retired, `## Invalid` list for files that failed to parse).
