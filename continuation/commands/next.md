---
description: Spawn the next Claude Code session in a fresh terminal (worktree-aware), auto-running /continue, with a distinct title + colour so parallel sessions are easy to tell apart.
allowed-tools: Bash(git:*), Bash(osascript:*), Bash(open:*), Bash(ls:*), Bash(test:*), Bash(basename:*), Bash(cksum:*), Bash(printf:*), AskUserQuestion, Write
argument-hint: [worktree-path-or-branch]
---

# /next — Launch the next session

Open a **new terminal** that auto-runs `/continue` in a chosen project or git worktree, labelled with a **distinct title + colour** so you can tell parallel sessions apart at a glance. macOS only.

`$ARGUMENTS` (optional) is a worktree path or branch name to target directly (skips the picker).

---

## Step 1 — Resolve the target directory

1. If `$ARGUMENTS` is non-empty:
   - If it is a path that exists (`test -d`), `TARGET_DIR` = that path (resolve to absolute).
   - Else treat it as a branch/worktree name: match it against `git worktree list --porcelain` and use the matching worktree's path. If nothing matches, tell the user and fall back to the picker below.
2. If `$ARGUMENTS` is empty:
   - Run `git worktree list` (in the current repo).
   - **If there is more than one worktree:** use `AskUserQuestion` to let the user pick the target — show each as `<dir-basename>  (<branch>)`, plus a "This project (current dir)" option. Default/recommended = the current repo root.
   - **If there is only the main checkout** (or not a git repo): `TARGET_DIR` = current repo root (`git rev-parse --show-toplevel`) or `pwd`.
3. Compute:
   - `TARGET_DIR` — absolute path.
   - `LEAF` = `basename "$TARGET_DIR"` (e.g. `library-phase4`).
   - `REPO` = basename of the **main** working tree: `basename "$(git -C "$TARGET_DIR" rev-parse --path-format=absolute --git-common-dir)/.."` resolved, or just the repo name. If `LEAF` already equals `REPO`, use `"$REPO (main)"` as the leaf label.

## Step 2 — Compute the label + colour (stable per worktree)

- `TITLE` = `"<REPO> · <LEAF>"` — e.g. `my-app · library-phase4`.
- Colour index, **deterministic from the worktree** so the same target always gets the same colour:
  `IDX = $(printf '%s' "$LEAF" | cksum | cut -d" " -f1) % 5`
- Palette (index → per-terminal colour):

  | IDX | name  | Terminal.app profile | Ghostty `--background` | iTerm2 RGB (0–65535)        |
  |-----|-------|----------------------|------------------------|----------------------------|
  | 0   | blue  | `Ocean`              | `11304a`               | `{4369, 12336, 18504}`     |
  | 1   | green | `Grass`              | `16331c`               | `{5654, 13107, 7196}`      |
  | 2   | red   | `Red Sands`          | `3a1c14`               | `{14906, 7196, 5140}`      |
  | 3   | sepia | `Novel`              | `2b2417`               | `{11051, 9252, 5911}`      |
  | 4   | slate | `Pro`                | `23262b`               | `{9009, 9766, 11051}`      |

- **Warp has no scriptable per-tab colour** — for Warp, set the **title only** (rely on the name to distinguish the session).

## Step 3 — Detect installed terminals + ask which

- Detect with `ls -d`: `/Applications/Warp.app`, `/Applications/Ghostty.app`, `/Applications/iTerm.app`. `Terminal.app` is always present.
- `AskUserQuestion` listing only the **installed** terminals. Note next to the current one "(current)" if `TERM_PROGRAM` matches (WarpTerminal → Warp, iTerm.app → iTerm2, Apple_Terminal → Terminal, ghostty → Ghostty).
- If only Terminal.app is available, skip the question and use it.

## Step 4 — Launch (verified launch methods)

The command to run in the new session is always:
`cd '<TARGET_DIR>' && claude '/continue'`
(Auto-runs the continue command. If a claude version doesn't auto-run a slash command from the initial argument, it simply opens at a prompt — the user types `/continue`.)

**For Terminal.app / iTerm2 / Warp, WRITE a temp AppleScript file and run it with `osascript`** — do not inline-quote (it breaks). Use `/tmp/claude-next-<terminal>.scpt`. For Ghostty, run `open` directly.

### Terminal.app (new window + colour profile + title) — verified
Write `/tmp/claude-next-terminal.scpt`:
```applescript
tell application "Terminal"
	activate
	set t to do script "cd '<TARGET_DIR>' && claude '/continue'"
	delay 0.4
	set current settings of t to settings set "<PROFILE>"
	set custom title of t to "<TITLE>"
end tell
```
Then: `osascript /tmp/claude-next-terminal.scpt`

### Ghostty (new window + background colour + title) — verified
```bash
open -na Ghostty --args \
  --working-directory='<TARGET_DIR>' \
  --title='<TITLE>' \
  --background='<GHOSTTY_HEX>' \
  -e zsh -ic "claude '/continue'; exec zsh"
```
(`--working-directory` already cds; `exec zsh` keeps the window after claude exits.)

### Warp (new TAB in current window + OSC title) — verified; needs Accessibility permission
Write `/tmp/claude-next-warp.scpt` (note the doubled backslashes — AppleScript needs them so the shell receives a literal `\e`/`\a` for printf):
```applescript
tell application "Warp" to activate
delay 0.5
tell application "System Events"
	keystroke "t" using command down
	delay 0.7
	keystroke "cd '<TARGET_DIR>' && printf '\\e]0;<TITLE>\\a' && claude '/continue'"
	delay 0.2
	key code 36
end tell
```
Then: `osascript /tmp/claude-next-warp.scpt`
(No per-tab colour in Warp — the OSC title is the distinguisher. Warp may or may not honour the OSC title depending on its settings; the tab still opens and runs regardless.)

### iTerm2 (new window + tab colour + name) — pattern; verify on first use
Write `/tmp/claude-next-iterm.scpt`:
```applescript
tell application "iTerm"
	activate
	set w to (create window with default profile)
	tell current session of w
		set name to "<TITLE>"
		set background color to {<ITERM_RGB>}
		write text "cd '<TARGET_DIR>' && claude '/continue'"
	end tell
end tell
```
Then: `osascript /tmp/claude-next-iterm.scpt`

## Step 5 — Confirm / fallback

- Print one line: `Launched <terminal> → <TITLE>  (<TARGET_DIR>)`.
- If the launch command errors (e.g. Accessibility not granted for the Warp keystroke), print the manual fallback and stop:
  `Run this yourself:  cd '<TARGET_DIR>' && claude '/continue'`

---

## Rules

- **macOS only.** If not on Darwin, print the manual one-liner and stop.
- **One launch per invocation.** Never open multiple terminals in a single `/next`.
- **Colour is best-effort:** Terminal.app / Ghostty / iTerm2 apply it; Warp gets the title only. Never fail the launch just because colour couldn't be set.
- **Colour is stable per worktree** (hash of the leaf name) so a given worktree always looks the same across sessions.
- Prefer the temp-AppleScript-file method over inline `osascript -e` quoting — embedded quotes/`&&`/escapes break inline.
- This command does not write continuations or commit anything — it only launches. Pair it with `/end` (write the handoff) → `/next` (open the next session) → `/continue` (auto-runs in the new window).
