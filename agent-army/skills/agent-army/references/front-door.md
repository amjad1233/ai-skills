# 🚪 Front Door — the operation interview 🫡

Run this **only after** the SKILL.md gate has recommended ARMY (or the user overrode the
recommendation). This is the second half of the Front Door: it gathers everything needed to
build the command centre and launch the fleet.

**How to run it:**
- Ask **one question at a time**, one per message — like `brainstorming`. Do **not** batch
  them into a single form.
- Prefer multiple choice; **lead with the recommended option** and say why.
- Ask **fresh every operation** — there is no stored config. Defaults are recommendations,
  not memory.
- Skip a question only if the user has already answered it earlier in the conversation.

The answers populate `manifest.json` (the machine-readable spine in SKILL.md) and `COMMAND.md`.

---

## Q1 — Groups / seams *(always ask — cannot be guessed)*

This is the **handoff from the spec session** (Session A). Confirm each genuinely-independent
group of work and its spec. One group = one agent = one branch. For each group capture:
- a short **name/label** (becomes the window title and `agents/<name>` files),
- its **spec source** — pluggable: an **OpenSpec** change dir, a **Todoist** project/section, a
  set of **JIRA** tickets, or a **markdown brief** (even a near-empty stub the agent expands),
- the **branch name** the agent will cut (`feature/<group>`).

If the user can't point at a spec per group, stop and decompose first (or drop to subagents) —
agents without a brief stall immediately.

## Q2 — Integration base + branch

- **Recommended:** cut `integration/<codename>` off the **current branch**; all agent PRs
  target it; one final PR `integration → base` at the end.
- Confirm the **base** (the branch the integration branch forks from, e.g. `main` or
  `release/x`). Records as `integrationBranch` + `integrationBase` in the manifest.

## Q3 — Operation codename

- **Recommended:** a generated memorable codename, e.g. `operation-azure-falcon` — *not* a
  timestamp. It names the command-centre directory `~/.claude/agent-army/<codename>/`.
- Offer one; let the user swap it.

## Q4 — Terminal substrate

**Default to a VISIBLE terminal window** — you want to *see* your agents working, not hunt for
them. `tmux` is hidden (a detached session you have to `attach` into); only recommend it when
there is no desktop to draw on (SSH/headless). Auto-detect what's actually present and offer
**only** those as a menu:

```bash
case "$(uname)" in
  Darwin)
    echo "TERM_PROGRAM=${TERM_PROGRAM:-}"   # Apple_Terminal | iTerm.app | WarpTerminal | vscode
    [ -d /Applications/iTerm.app ] && echo "iTerm present"
    [ -d /Applications/Warp.app ]  && echo "Warp present"
    echo "Terminal.app always present" ;;
  Linux)
    for t in gnome-terminal konsole xterm; do command -v $t >/dev/null && echo "$t present"; done ;;
  *)  # Windows (Git Bash / MSYS)
    command -v wt.exe >/dev/null && echo "Windows Terminal present"
    command -v powershell.exe >/dev/null && echo "PowerShell present" ;;
esac
command -v tmux >/dev/null && echo "tmux available (headless only)"
[ -n "${SSH_TTY:-}" ] && echo "headless/SSH — VISIBLE terminals unavailable, use tmux"
```

Present the detected options as a menu, **leading with a visible window**:

| Platform | Offer (recommended first)                                   | `--terminal` value         |
|----------|-------------------------------------------------------------|----------------------------|
| macOS    | **Terminal.app** · iTerm · Warp                             | `terminal-app`/`iterm`/`warp` |
| Ubuntu/Linux | **GNOME Terminal** · Konsole · xterm                    | `gnome-terminal`/`konsole`/`xterm` |
| Windows  | **Windows Terminal** · PowerShell                           | `windows-terminal`/`powershell` |
| Any (SSH/headless) | **tmux** (survives disconnect, `capture-pane`) · nohup | `tmux`/`nohup`      |

- **Recommended:** the stock visible terminal for the desktop they're on (Terminal.app on mac,
  GNOME Terminal on Ubuntu, Windows Terminal on Windows). Pick `tmux` **only** for SSH/headless.
- **Warning:** Ghostty's `open -na … -e` silently orphans the launched process on macOS — the
  launch looks successful but no agent runs. Don't offer Ghostty; use Terminal.app/iTerm/Warp.
- Maps to `launch-agent.sh --terminal <value>` (or `--tmux`, an alias for `--terminal tmux`).
  Omitting the flag auto-detects, also visible-first.

## Q5 — Models

- **Recommended:** uniform `sonnet` — the cost/quality sweet spot when specs are written.
- Offer **by size:** S→`haiku`/`sonnet`, M→`sonnet`, L/complex→`opus`. Set per-agent in the
  manifest's `model` field.

## Q6 — Permissions stance

- **Supervised (default for untrusted work):** the agent prompts for risky actions.
- **Autonomous (`--dangerously-skip-permissions`):** required for true fire-and-forget, but a
  real security trade-off — only for **trusted, sandboxed** work. Spell this out before the
  user picks it.

## Q7 — Babysit cadence

The gate already confirmed a human *will* check in. Capture a rough **interval** (e.g. every
30–60 min) so BLOCKED agents don't sit idle burning a meter. Informational; sets expectations.

## Q8 — stallSeconds *(only if they care)*

- **Default:** `900` (15 min with no commit/transcript progress → flagged STALLED).
- Lower it for short, fast seams; raise it for long compiles. Records as `stallSeconds`.

---

## 🏁 Terminus — write state, then launch

Once answered:
1. Write `manifest.json` with `operation`, `projectRoot`, `integrationBranch`,
   `integrationBase`, `commandCentre`, `stallSeconds`, and one `agents[]` entry per group
   (`name`, `branch`, `worktree`, `spec`, `model`, `startDir`).
2. Create `COMMAND.md`, `agents/<name>.brief.md`, and `agents/<name>.status.md` from the
   `templates/`.
3. **Echo the operation summary back to the user** for a final sign-off (checklist item 5).
4. Return to SKILL.md **Operation lifecycle step 4** — launch each agent and verify liveness
   within ~15s.
