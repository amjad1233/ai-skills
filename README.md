# ai-skills

> Amjad's open-source [Claude Code](https://claude.com/claude-code) skills — one marketplace,
> each skill a complete standalone plugin. Add the marketplace once, install whichever you want.

**🌐 Explainer & install guide:** [claude-skills.amjad1233.com](https://claude-skills.amjad1233.com)

[![skills.sh](https://skills.sh/b/amjad1233/ai-skills)](https://skills.sh/amjad1233/ai-skills)

## Install

Two ways in, two philosophies. **The Claude Code plugin** installs a skill as a managed bundle that
updates when I ship — you subscribe rather than fork, and you get the slash commands too.
**[skills.sh](https://skills.sh/amjad1233/ai-skills)** copies editable skill files into your
project or home directory, and works on ~75 agents, not just Claude Code. Pick one — installing both
leaves you with every skill twice.

### Claude Code plugin

```
/plugin marketplace add amjad1233/ai-skills
```

Then install any skill from the marketplace:

```
/plugin install agent-army@amjad1233
/plugin install continuation@amjad1233
```

(`@amjad1233` is the marketplace name, not the GitHub handle.)

### Any agent — Codex, Cursor, opencode, Claude Code

```
npx skills add amjad1233/ai-skills
```

Pick the skills you want and which agents to install them on. Non-interactive:

```
npx skills add amjad1233/ai-skills --skill agent-army -a claude-code -g -y
```

Files land in your repo as ordinary files you own and can edit; pull later changes with
`npx skills update`. Note that `/next` (fresh-terminal launcher) ships only in the Claude Code
plugin — the portable skill covers the handoff/resume loop.

## Skills

| Skill | What it does |
|---|---|
| [**agent-army**](agent-army/) | Run a fleet of autonomous Claude Code agents in parallel — one per independent seam, each in its own git worktree, coordinated by a changeable master through an on-disk command centre. Opens with a Front Door interview that routes cheap work elsewhere. |
| [**continuation**](continuation/) | Project memory for any coding agent. Typed decisions, learnings, conventions and session handoffs in `.continuation/`, written as you work and read in one hot file every session. `/end`, `/continue`, `/remember`, `/continuation-review`, `/next`. |

Each lives in its own subdirectory as a self-contained plugin (`.claude-plugin/plugin.json` +
its skills/commands). More get added as new subdirectories + one line in
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

## Roadmap

- [ ] **Agent Army** for [opencode](https://github.com/sst/opencode) & other providers
- [x] **Continuation** for opencode & other agents — via `npx skills add amjad1233/ai-skills`
- [ ] Auto checkpoints for opencode via its plugin hooks
- [ ] Open-source the **Jokerize** skill here

## Repo layout

```
ai-skills/
├── .claude-plugin/marketplace.json   # the marketplace ("amjad1233"), lists every plugin
├── agent-army/                       # standalone plugin
├── continuation/                     # standalone plugin
└── docs/                             # the landing page (claude-skills.amjad1233.com)
```

## Licence

MIT — see [LICENSE](LICENSE).
