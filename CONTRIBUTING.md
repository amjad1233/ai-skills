# Contributing to ai-skills

Thanks for your interest! This repo is a [Claude Code](https://claude.com/claude-code) plugin
marketplace. Each skill is a complete, standalone plugin in its own subdirectory.

## Add a new skill

1. Create a subdirectory at the repo root, e.g. `my-skill/`.
2. Add `my-skill/.claude-plugin/plugin.json` (name, description, version, author, license).
3. Add the skill's content — `skills/<name>/SKILL.md` and/or `commands/*.md`.
4. Register it: add one entry to [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json):
   ```json
   { "name": "my-skill", "source": "./my-skill", "description": "…" }
   ```
5. Open a PR. Keep each skill self-contained — no cross-skill coupling.

## Test it locally

```
/plugin marketplace add /absolute/path/to/your/clone
/plugin install my-skill@amjad1233
```

## Guidelines

- Keep skills focused — one clear job each.
- MIT-licensed contributions only.
- Document the "why" behind non-obvious design choices.

Issues and PRs welcome at [github.com/amjad1233/ai-skills](https://github.com/amjad1233/ai-skills).
